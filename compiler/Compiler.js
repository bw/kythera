const Scope = require("./Scope")

// runtime-side representations of values and types
const KytheraValue = require("./runtime").value
const KytheraType = require("./runtime").type

class Compiler {
	constructor(program = null) {
		if(program !== null) {
			this.load(program)
		}
	}

	load(program) {
		this.program = program

		// symbol table
		this.rootScope = new Scope()
		this.currentScope = this.rootScope
	}

	// compile
	visitProgram() {
		if(typeof this.program !== "object") {
			throw new Error("No program is loaded.")
		}

		// clear symbol table
		this.rootScope = new Scope()
		this.currentScope = this.rootScope

		return this.program.reduce((prev, node) => {
			let prog = prev + this.visitNode(node) + ';\n'
			console.log(prog)
			return prog
		}, "")
	}

	// main statement dispatcher
	visitNode(node) {
		switch(node.kind) {
			// statements
			case "let":
				return this.visitLet(node)
			case "assign":
				return this.visitAssign(node)
			case "return":
				return this.visitReturn(node)
			default:
				return this.visitExpressionNode(node).output
		}
	}

	// expression node dispatcher
	// every expression returns a tuple: the string output and the KytheraType of the result.
	visitExpressionNode(node) {
		switch(node.kind) {
			case "new":
				return this.visitNew(node)
			case "identifier":
				if(this.currentScope.has(node.name)) {
					return {
						output: node.name,
						type: this.currentScope.get(node.name)
					}
				} else {
					throw new Error("Undefined variable: " + node.name)
				}
			case "literal":
				return this.visitLiteral(node)
			default:
				throw new Error("Unhandled node kind: " + node.kind)
		}
	}

	visitLiteral(node) {
		switch(node.type.type) {
			case "int":
			case "float":
			case "bool":
			case "str":
			case "null":
				return {
					output: this.makeValueConstructor(new KytheraValue(node.value, KytheraType.PRIMITIVES[node.type.type])),
					type: KytheraType.PRIMITIVES[node.type.type]
				}
			case "type":
				return {
					output: this.makeValueConstructor(new KytheraValue(this.makeKytheraType(node.value), KytheraType.PRIMITIVES.type)),
					type: KytheraType.PRIMITIVES.type
				}
			case "fn":
				let fnType = this.makeKytheraType(node.type)
				return {
					output: this.makeValueConstructor(
						new KytheraValue(
						{
							parameters: node.parameters,
							body: node.body,
							returns: node.returns
						},
						fnType)
					),
					type: fnType
				}
			case "obj":
				let objType = this.makeKytheraType(node.type)
				return {
					output: this.makeValueConstructor(new KytheraValue(node.value, objType)),
					type: objType
				}
			default:
				throw new Error("Unhandled type: " + node.type.type)
		}
	}

	visitNew(node) {
		let targetType = this.makeKytheraType(node.target)
		console.log("Target type for new:")
		console.log(JSON.stringify(targetType, null, 2))

		// TODO support for custom named types
		return {
			output: this.makeTypeConstructor(targetType) + ".makeNew()",
			type: targetType
		}
	}

	visitLet(node) {
		let result = this.visitExpressionNode(node.value)
		this.currentScope.create(node.identifier, result.type)
		return `let ${node.identifier} = ${result.output}`
	}

	visitAssign(node) {
		if(node.left.kind === "identifier") {
			// let lhsType = this.makeKytheraType(node.left)
			let lhsType = this.currentScope.get(node.left.name)
			let rhs = this.visitExpressionNode(node.right)
			if(!this.currentScope.get(node.left.name).eq(rhs.type)) {
				throw new Error(`Cannot assign ${rhs.type} value to ${node.left.name}, which has type ${lhsType.type}`)
			} else {
				return `${node.left.name} = ${rhs.output}`
			}
		} else if(node.left.kind === "objAccess" || node.left.kind === "access") {
			throw new Error("Writing to object member not yet supported")
		} else {
			throw new Error(`${node.left.kind} is not valid as an assignment target`)
		}
	}

	// TODO check return type against what the function expects
	// we can do that by storing function info with the scope
	visitReturn(node) {
		if(this.currentScope.isInFunction()) {
			return `return ${this.visitExpressionNode(node.value).output}`
		}
	}

	// transform a type ParseNode into a KytheraType
	makeKytheraType(node) {
		if(node.kind !== "type") {
			throw new Error("Expected a type ParseNode but got " + JSON.stringify(node, null, 2))
		}

		if(node.name) {
			throw new Error("named types not yet supported")
		}

		switch(node.type) {
			case "int":
			case "float":
			case "bool":
			case "str":
			case "null":
			case "type":
				return KytheraType.PRIMITIVES[node.type]
			case "fn":
				return new KytheraType(node.type, {
					parameters: node.parameters.map((param, i) => {
						return this.makeKytheraType(param)
					}),
					returns: this.makeKytheraType(node.returns)
				})
			case "obj":
				let structure = {}
				Object.entries(node.structure).forEach(([key, value], i) => {
					structure[key] = this.makeKytheraType(value)
				})
				return new KytheraType(node.type, structure)
			case "list":
				throw new Error("Not yet implemented")
			default:
				throw new Error("Invalid builtin type: " + node.type)
		}
	}

	// make runtime-side constructor call for a KYTHERA.value
	makeValueConstructor(kytheraValue) {
		if(!(kytheraValue instanceof KytheraValue)) {
			throw new Error("Value must be a Kythera runtime value.")
		}
		// it is now safe to assume that the value corresponds to the type and type structure

		let kytheraType = kytheraValue.type

		// shim, will go away
		let value = kytheraValue.value

		let out = `new KYTHERA.value(`
		if(kytheraType.type === "str") {
			out += `"${value}"`
		} else if(kytheraType.type === "fn") {
			// extend scope one level
			this.currentScope = new Scope(this.currentScope, "function")

			out += "("
			// build parameter list and bring parameters into scope
			out += value.parameters.reduce((prev, param, i) => {
				this.currentScope.create(param.name, kytheraType.structure.parameters[i])
				return prev + param.name + ((i !== value.parameters.length - 1) ? "," : "")
			}, "")

			out += ') => {\n'

			// TODO verify that the function returns
			// build body statements
			out += value.body.reduce((prev, statement, i) => {
				return prev + this.visitNode(statement) + ';\n'
			}, "")

			out += '}'
		} else if(kytheraType.type === "obj") {
			out += "{"

			out += Object.entries(value).reduce((prev, [key, val], i) => {
				return prev + `"${key}": ${this.visitExpressionNode(val).output},`
			}, "")

			out += "}"
		} else if(kytheraType.type === "type") {
			out += this.makeTypeConstructor(value)
		} else {
			out += value
		}

		out += `, ${this.makeTypeConstructor(kytheraType)})`

		return out
	}

	// make runtime-side constructor call for a KYTHERA.type, from a KYTHERA.type. This wrinkles my brain
	makeTypeConstructor(type) {
		if(!(type instanceof KytheraType)) {
			throw new Error("Type must be a Kythera runtime type.")
		}
		let out = `new KYTHERA.type("${type.type}"`

		if(type.type === "fn") {
			out += ", { parameters: ["

			out += type.structure.parameters.reduce((prev, param, i) => {
				return prev + this.makeTypeConstructor(param) + ((i < type.structure.parameters.length - 1) ? "," : "")
			}, "")

			out += `], returns: ${this.makeTypeConstructor(type.structure.returns)}}`
		} else if(type.type === "obj") {
			out += ", {"

			out += Object.entries(type.structure).reduce((prev, [key, val], i) => {
				return prev + `"${key}": ${this.makeTypeConstructor(val)},`
			}, "")

			out += "}"
		} else if(type.type === "list") {
			throw new Error("Not yet implemented")
		} else {
			return `KYTHERA.type.PRIMITIVES["${type.type}"]`
		}
		out += ")"
		return out
	}
}

module.exports = Compiler
const fs = require("fs")
const Parser = require("./parser/Parser")
const Compiler = require("./compiler/Compiler")

try {
	if (process.argv.length >= 3) { // run file
		const flags = {}
		process.argv.filter(flag => flag.charAt(0) === "-").forEach(flag => flags[flag.replace("-", "")] = true)

		let parser = new Parser(fs.readFileSync(process.argv[2]).toString())
		let ast = parser.parse()

		if(!flags.c) {
			console.log(JSON.stringify(ast, null, 2))
		}

		let compiler = new Compiler(ast)
		let output = `const KYTHERA = require("./compiler/runtime");\n` + compiler.visitProgram()
		if(!flags.c) {
			console.log("Compilation complete:\n")
		}
		console.log(output)

		if(!flags.c) {
			// output all variables at top-level scope
			Object.keys(compiler.rootScope.symbols).forEach((key, i) => {
				output += `console.log("${key}:");\nconsole.log(${key});\n`
			})

			console.log("Executing...")
			eval(output)
		}
	} else {
		console.log("Starting interactive mode.\n" +
			"This is not a proper REPL. Variables are not saved between executions.\n" +
			"Enter code line by line. Enter a blank line to execute.")

		const readline = require("readline")
		const stdin = readline.createInterface(process.stdin, process.stdout)

		const parser = new Parser()
		const compiler = new Compiler()

		let codeBlock = ""

		stdin.setPrompt("==> ")
		stdin.prompt()
		stdin.on("line", (line) => {
			try {
				if(line === "") { // execute
					parser.load(codeBlock)
					let lineNodes = parser.parse()

					console.log("Parse tree:")
					console.log(JSON.stringify(lineNodes, null, 2))
					console.log()

					compiler.load(lineNodes)
					let result = compiler.visitProgram()
					console.log("Compiled result:")
					console.log(result)

					// output all variables at top-level scope
					Object.keys(compiler.rootScope.symbols).forEach((key, i) => {
						result += `console.log("${key}:");\nconsole.log(${key});\n`
					})
					result += ``

					console.log("Evaluated output:")
					eval(`const KYTHERA = require("./compiler/runtime");\n${result}`)

					codeBlock = ""
					stdin.setPrompt("==> ")
				} else { // accumulate
					codeBlock += line + "\n"
					stdin.setPrompt("  > ")
				}
			} catch (e) {
				console.log(e + "\n")
				codeBlock = ""
				stdin.setPrompt("==> ")
			}

			stdin.prompt()
		})
	}
} catch (e) {
	console.log(e)
	return
}

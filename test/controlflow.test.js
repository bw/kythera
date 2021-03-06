const t = require("./util").test

describe("Control flow", () => {
	describe("if", () => {
		t("if", `
if true {
	true
}	
	`)

		t("if-else", `
if false {
    false
} else {
    true
}	
	`)

		t("if-else-if", `
let a = 3
if a == 1 {
    "one"
} else if a == 2{
    "two"
} else {
    "something else"
}	
	`)

		t("if-else with boolean", `
let a = 1
let b = 2
if a == b {
    a
} else {
    b
}	
	`)

		t("if-else-if with boolean", `
let a = 1
let b = 2
let c = 3
let result = new str
if a == b {
	result = "a equals b"
} else if b == c {
	result = "b equals c"
} else {
	result = "neither"
}	
	`)

	})

	describe("while", () => {
		t("while", `
let a = 0
let b = 0
while a == b {
    a = a + 2
}	
	`)

		t("while", `
let x = 0
while x < 10 {
    x = x + 1
}

x	
	`)
	})
})
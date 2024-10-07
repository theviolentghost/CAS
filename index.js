const { Expression } = require("./CAS.js");

const expression = new Expression("(x^2 + 1) / (x^2 + 1)");
expression.simplify();
//expression.derivative();

while(true) {
    let a;
}
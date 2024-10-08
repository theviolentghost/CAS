const { Expression } = require("./CAS.js");

let expression = new Expression("10* tan(x^4 - 1)");
//let r = expression.simplify();
let r = expression.derivative();

console.log("d/dx 10* tan(x^4 - 1): ",r.string)

expression = new Expression("ln(x^4)");
//let r = expression.simplify();
r = expression.derivative();

console.log("d/dx ln(x^4): ",r.string)

expression = new Expression("exp(2x^2+1)");
//let r = expression.simplify();
r = expression.derivative();

console.log("d/dx exp(2x^2+1): ",r.string)

/*while(true) {
    let a;
}*/
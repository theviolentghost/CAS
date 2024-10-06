const CAS = require("./CAS.js").Expression;

let expression = new CAS("4*x^2 + 6 - 4 + x^2 - 1 - 2 - 3");
console.log(expression.tree)
expression.simplify();

//console.log(expression);

// expression = new CAS("(x+1)/(x+1)");
// expression.simplify();

//console.log(expression);
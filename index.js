const { Expression } = require("./CAS.js");

//Isaac: write an expression for the progarm to simplify
let expression = new Expression("(1+175-7)/(0-7+1)");
let r = expression.simplify();
//let r = expression.derivative();

console.log("",r.string)


/*while(true) {
    let a;
}*/
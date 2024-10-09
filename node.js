class Node {
    type = "node";
    parent = null;


    derivative() { return ""; }
    integral() { return ""; }
    isZero() { return false; }
    isOne() { return false; }
    toString() { return ""; }
    copy() {
        //not really a needed function, since all operastions of Node create a new instance of Node
        const newNode = new this.constructor();
        const properties = Object.getOwnPropertyNames(this);
        
        // Copy each property to the new instance
        for (const prop of properties) {
            const value = this[prop];
            
            // Handle different types of properties
            if (value === null || value === undefined) {
                newNode[prop] = value;
            }
            // If the property is a Node, recursively copy it
            else if (value instanceof Node) {
                newNode[prop] = value.copy();
            }
            // If the property is an array, copy each element
            else if (Array.isArray(value)) {
                newNode[prop] = value.map(item => 
                    item instanceof Node ? item.copy() : item
                );
            }
            // If the property is an object, deep copy it
            else if (typeof value === 'object') {
                newNode[prop] = JSON.parse(JSON.stringify(value));
            }
            // For primitive values, direct assignment
            else {
                newNode[prop] = value;
            }
        }
        
        return newNode;
    }
    static sameType(node1, node2) {
        return node1?.type === node2?.type;
    }
    static isConstant(node) {return node?.type === "constant"}
    static isOperator(node) {return node?.type === "operator"}
    static isFunction(node) {return node?.type === "function"}
    static isVariable(node) {return node?.type === "variable"}
}

class Constant extends Node {
    type = "constant";
    static get ONE() {
        return new this(1);
    }
    static get ZERO() {
        return new this(0);
    }
    static get NEGATIVE() {
        return new this(-1);
    }
    constructor(value = 0) {
        super();
        this.value = value;
        //this.coefficient = this.value;
    }
    fraction() {
        function gcd(a, b) {
            return b ? gcd(b, a % b) : Math.abs(a);
        }

        // If it's already an integer, return it as a fraction with denominator 1
        if (Number.isInteger(this.value)) {
            return {
                numerator: this.value,
                denominator: 1,
                value: this.value,
                display: `${this.value}`
            };
        }

        //rewrite to make better results, 7/3 testcase

        // Convert the number to a string to avoid floating point issues
        const strNum = this.value.toString();
        const decimalPlaces = strNum.split('.')?.[1]?.length;
        if(decimalPlaces == 0) return {display:this.value} //temp cuz im lazy

        // Calculate numerator and denominator
        const denominator = Math.pow(10, decimalPlaces);
        const numerator = this.value * denominator;

        // Simplify the fraction
        const divisor = gcd(numerator, denominator);
        const simplifiedNumerator = numerator / divisor;
        const simplifiedDenominator = denominator / divisor;

        // Return the fraction object
        return {
            numerator: simplifiedNumerator,
            denominator: simplifiedDenominator,
            value: this.value,
            display: `${simplifiedNumerator}/${simplifiedDenominator}`
        };
    }
    isZero() {
        return this.value === 0;
    }
    isOne() {
        return this.value === 1;
    }
    isConstant() {
        return true;
    }
    negative() {
        return this.multiply(Constant.NEGATIVE);
    }
    derivative() {
        return Constant.ZERO;
    }
    integral() {
        if(this.isZero()) return Constant.ZERO;

        return new Variable("x", this);
    }
    add(node) {
        if(!node) return null;
        switch(node.type){
            case "constant":
                return new Constant(node.value + this.value);
            case "variable":
            case "function":
                return new Operator("+", node, this);
            case "operator":
                node.left.add(this);
                return node;
        }
        console.error("error adding:", this, "with", node);
        return new Operator("+", node, this); //fail safe
    }
    subtract(node) {
        if(!node) return null;
        switch(node.type){
            case "constant":
                return new Constant(this.value - node.value);
            case "variable":
            case "function":
                return new Operator("-", this, node);
            case "operator":
                return new Operator("-", this, node); //could have problems without parenthesis ()
        }
        console.error("error subtracting:", this, "by", node);
        return new Operator("-", this, node); //fail safe
    }
    multiply(node) {
        if(!node) return null;
        switch(node.type){
            case "constant":
                return new Constant(node.value * this.value);
            case "variable":
            case "function":
                return node.multiply(this);
            case "operator":
                node.left.multiply(this);
                node.right.multiply(this);
                return node;
        }
        console.error("error multipling:", this, "with", node);
        return new Operator("*", node, this); //fail safe
    }
    divide(node) {
        if(!node) return null;
        if(node.isZero()) return console.error("cannot divide by zero");
        switch(node.type){
            case "constant":
                return new Constant(this.value / node.value);
            case "variable":
            case "function":
            case "operator":
                return new Operator("/", this, node); //cannot simplify
        }
        console.error("error multipling:", this, "with", node);
        return new Operator("/", this, node); //fail safe
    }
    power(node) {
        if(!node) return;
        switch(node.type) {
            case "constant":
                return new Constant(Math.pow(this.value, node.value));
            case "variable":
            case "function":
            case "operator":
                return new Operator("^", this, node);
        }
        console.error("error raising", this, "to the", node, "power");
        return new Operator("^", this, node);
    }
    toString() {
        if(Number.isInteger(this.value)) return `${this.value}`;
        return this.fraction().display;
    }
}

class Variable extends Node {
    type = "variable";
    static get X() {
        return new this("x");;
    }
    static get Y() {
        return new this("y");
    }
    static get Z() {
        return new this("z");
    }
    constructor(variableName = "x", coefficient = Constant.ONE, exponent = Constant.ONE) {
        super();
        this.name = variableName;
        this.coefficient = coefficient;
        this.exponent = exponent;
    }
    isZero() {
        return this.coefficient.isZero();
    }
    isOne() {
        return this.exponent.isZero();
    }
    isConstant() {
        return this.coefficient.isZero() || this.exponent.isZero();
    }
    negative() {
        return this.multiply(Constant.NEGATIVE);
    }
    derivative() {
        if(this.isPolynomial()) return this.polynomialDerivative();
        return this.logarithmicDerivative();
    }
    isPolynomial() {
        return this.exponent.type === "constant";
    }
    polynomialDerivative() {
        if(this.exponent.subtract(Constant.ONE).isZero()) return new Constant(this.coefficient);
        return new Variable(this.name, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
    }
    logarithmicDerivative() {
        let u = this;
        let v = new Function("ln", this.exponent);
        let z = new Variable(this.name);
        return new Operator("*", 
            u,
            new Operator("*", v, z).derivative()
        );
    }
    integral() {
        
    }
    add(node) {
        if (!node) return this;
        switch (node.type) {
            case "constant":
                return node.isZero() ? this : new Operator("+", this, node);
            case "variable":
                if (this.name === node.name && this.exponent.toString() === node.exponent.toString()) {
                    return new Variable(
                        this.name,
                        this.coefficient.add(node.coefficient),
                        this.exponent
                    );
                }
                return new Operator("+", this, node);
            default:
                return new Operator("+", this, node);
        }
    }

    subtract(node) {
        if (!node) return this;
        switch (node.type) {
            case "constant":
                return node.isZero() ? this : new Operator("-", this, node);
            case "variable":
                if (this.name === node.name && this.exponent.toString() === node.exponent.toString()) {
                    return new Variable(
                        this.name,
                        this.coefficient.subtract(node.coefficient),
                        this.exponent
                    );
                }
                return new Operator("-", this, node);
            default:
                return new Operator("-", this, node);
        }
    }

    multiply(node) {
        if (!node) return this;
        switch (node.type) {
            case "constant":
                return new Variable(
                    this.name,
                    this.coefficient.multiply(node),
                    this.exponent
                );
            case "variable":
                if (this.name === node.name) {
                    return new Variable(
                        this.name,
                        this.coefficient.multiply(node.coefficient),
                        this.exponent.add(node.exponent)
                    );
                }
                return new Operator("*", this, node);
            case "function":
                return new Function(
                    node.name,
                    node.input,
                    this.multiply(node.coefficient),
                    node.exponent,
                );
            default:
                return new Operator("*", this, node);
        }
    }

    divide(node) {
        if (!node) return this;
        if (node.isZero()) throw new Error("Division by zero");
        switch (node.type) {
            case "constant":
                return new Variable(
                    this.name,
                    this.coefficient.divide(node),
                    this.exponent
                );
            case "variable":
                if (this.name === node.name) {
                    return new Variable(
                        this.name,
                        this.coefficient.divide(node.coefficient),
                        this.exponent.subtract(node.exponent)
                    );
                }
                return new Operator("/", this, node);
            default:
                return new Operator("/", this, node);
        }
    }

    power(node) {
        if (!node) return this;
        switch (node.type) {
            default:
                return new Variable(this.name, this.coefficient.power(node), this.exponent.multiply(node))
        }
    }
    toString() {
        let prefix = this.coefficient.type === "constant" && this.coefficient.value === 1 ? "" : this.coefficient.toString();
        let suffix = this.exponent.type === "constant" && this.exponent.value === 1 ? "" : `^(${this.exponent.toString()})`;
        return `${prefix}${this.name}${suffix}`;
    }
}

class Operator extends Node {
    type = "operator";
    set left (node) {
        this._left = node;
        this.order();
    }
    set right (node) {
        this._right = node;
        this.order();
    }
    get left () {
        return this._left;
    }
    get right () {
        return this._right;
    }
    constructor(operator = "+", left = Constant.ZERO, right = Constant.ZERO) {
        super();
        //this.name = operator;
        this.operator = operator;
        this._left = left;
        this._right = right;

        if(this._left) this._left.parent = this;
        if(this._right) this._right.parent = this;

        //fix parent issue

        if(this.operator === "-") {
            this.operator = "+";
            this.name = "+";
            this.right = this._right.negative();
        }

        this.order();
    }
    isZero() {
        return false; //placeholder
    }
    isOne() {
        return false;
    }
    isConstant() {
        return this.left.isConstant() && this.right.isConstant();
    }
    negative() {
        return new Operator(this.operator, this.left.negative(), this.right.negative());
    }
    derivative() {
        switch(this.operator) {
            case "+":
            case "-":
                return this.standardDerivative();
            case "*":
                return this.productDerivative();
            case "/":
                return this.logarithmicDerivative();
            case "^":
                //logrithmric
        }
        console.log(this)
        console.error("unknown symbol", this.operator);
    }
    standardDerivative() {
        return new Operator(this.operator, this.left.derivative(), this.right.derivative());
    }
    productDerivative() {
        // Product rule: (u*v)' = u'v + uv'
        return new Operator("+",
            new Operator("*", this.left, this.right.derivative()),
            new Operator("*", this.left.derivative(), this.right)
        );
    }
    logarithmicDerivative() {
        // rule of logs 
        // y = x / x^2
        // ln(y) = ln(x) - ln(x^2)
        // 1/y*dydx = 1/x - 1/x^2 * 2x
        // dydx = x / x^2 (1/x - 2x/x^2 )
        // (u/v) = u / v (d[ln(u)] - d[ln(v)])
        // (u/z) = d[ln(u)] * u / v - d[ln(v)] * u / v
        let derivative = new Operator("-",
            new Operator("*", 
                new Function("ln", this.left).derivative(),
                new Operator("/", 
                    this.left,
                    this.right
                )
            ),
            new Operator("*", 
                new Function("ln", this.right).derivative(),
                new Operator("/", 
                    this.left,
                    this.right
                )
            ),
        );

        return derivative;
    }
    add(node) {
        if (!node) return this;
        if (node.type === "constant" && node.isZero()) return this;
        return new Operator("+", this, node);
    }

    subtract(node) {
        if (!node) return this;
        if (node.type === "constant" && node.isZero()) return this;
        return new Operator("-", this, node);
    }

    multiply(node) {
        if (!node) return this;
        if(node.isZero()) return Constant.ZERO;
        if(node.isOne()) return this;

        switch (node.type) {
            default:
                return new Operator(this.operator,
                    this.left.multiply(node),
                    this.right.multiply(node)
                );
        }
        return new Operator("*", this, node);
    }

    divide(node) {
        if (!node) return this;
        if (node.isZero()) throw new Error("Division by zero");
        if (node.type === "constant" && node.value === 1) return this;
        return new Operator("/", this, node);
    }

    power(node) {
        if (!node) return this;
        if (node.type === "constant") {
            if (node.isZero()) return Constant.ONE;
            if (node.value === 1) return this;
        }
        return new Operator("^", this, node);
    }
    simplify() {
        if(Node.isOperator(this.left)) this.left = this.left.simplify();
        if(Node.isOperator(this.right)) this.right = this.right.simplify();

        switch(this.operator) {
            //use built in node methods to simplify
            //if node cant simplify an identical operator node will return
            case "+":
                return this.left.add(this.right);
            case "-":
                return this.left.subtract(this.right);
            case "*":
                return this.left.multiply(this.right);
            case "/":
                return this.left.divide(this.right);
            case "^":
                return this.left.power(this.right);
        }
        console.error("unknown operator:", this.operator);
        return this;
    }
    static nodePrecedence = {
        "constant": 1,
        "variable": 2,
        "function": 3,
        "operator": 4
    }
    static nonOrderableOperators = ["/", "^", "-"];
    preventOrder() {
        return Operator.nonOrderableOperators.includes(this.operator);
    }
    order(force = false) {
        //orders the function so no matter what orientation the toString method will be the same
        if(!force && this.preventOrder()) return
        //if(Operator.canCombine(this.operator, this.left, this.right)) return;
        
        if(Operator.orderTerms(this.left, this.right) === -1) {
            let temporary = this.left;
            this.left = this.right;
            this.right = temporary;
        }
    }
    static orderTerms(node1, node2) {
        //retunr -1, 0, 1 or based on how to swap

        function getStringValue(str) {
            let totalValue = 0;
            for (let i = 0; i < str.length; i++) {
              totalValue += str.charCodeAt(i);  // Get the character code and add to the sum
            }
            return totalValue;
        }

        let leftPrecedence = Operator.nodePrecedence[node1?.type?.toLowerCase()] || 0;
        let rightPrecedence = Operator.nodePrecedence[node2?.type?.toLowerCase()] || 0;

        if(leftPrecedence == 0 && rightPrecedence == 0) return 0;

        if(rightPrecedence > leftPrecedence) return -1;
        else if(leftPrecedence === rightPrecedence) {
            if(Node.sameType(node1, node2) && Node.isOperator(node1)) {
                //operators
                leftPrecedence = getStringValue(node1.toString());
                rightPrecedence = getStringValue(node2.toString());

                if(rightPrecedence > leftPrecedence) return -1;
                return 0;
            }
            const leftExponentPrecedence = this.nodePrecedence[node1.exponent?.type?.toLowerCase()] || 0;
            const rightExponentPrecedence = this.nodePrecedence[node2.exponent?.type?.toLowerCase()] || 0;

            if(rightExponentPrecedence > leftExponentPrecedence) return -1;
            
            leftPrecedence = getStringValue(node1.toString());
            rightPrecedence = getStringValue(node2.toString());

            if(rightPrecedence > leftPrecedence) return -1;
            return 0;
        }
        return 0;
    }
    static canCombine(operator, node1, node2) {
        switch(operator) {
            case "+":
            case "-":
                return Node.sameType(node1, node2) && (
                    Node.isConstant(node1) ||
                    (
                        (Node.isVariable(node1) || (Node.isFunction(node1) && node1.input.toString() === node2.input.toString())) && 
                        node1.name === node2.name && node1.exponent.toString() === node2.exponent.toString()
                    )
                )
            case "*":
                return Node.sameType(node1, node2) && (
                    Node.isConstant(node1) ||
                    (
                        (Node.isVariable(node1) || (Node.isFunction(node1) && node1.input.toString() === node2.input.toString())) && 
                        node1.name === node2.name
                    )
                )
            default:
                return false;
        }
    }
    toString() {
        if(this.operator === "+" || this.operator === "-") return `${this.left.toString()}${this.operator}${this.right.toString()}`;
        return `(${this.left.toString()})${this.operator}(${this.right.toString()})`;
    }
}

class Function extends Node {
    type = "function";
    static functions = ["sin", "cos", "tan", "csc", "sec", "cot", "ln", "exp", "arcsin", "arccos", "arctan", "arccsc", "arcsec", "arccot"];
    static get Sin() { return new this("sin"); }
    static get Cos() { return new this("cos"); }
    static get Tan() { return new this("tan"); }
    static get Csc() { return new this("csc"); }
    static get Sec() { return new this("sec"); }
    static get Cot() { return new this("cot"); }
    static get Ln() { return new this("ln"); }
    static get Exp() { return new this("exp"); }
    static get Arcsin() { return new this("arcsin"); }
    static get Arccos() { return new this("arccos"); }
    static get Arctan() { return new this("arctan"); }
    constructor(functionName = "sin", functionInput = Variable.X, coefficient = Constant.ONE, exponent = Constant.ONE) {
        super();
        this.name = functionName;
        this.input = functionInput;
        if(Node.isOperator(this.input)) {
            this.input = this.input.simplify();
        }
        this.coefficient = coefficient;
        this.exponent = exponent;
    }
    isZero() {
        return false; //placeholder
    }
    isOne() {
        return this.exponent.isZero() && this.coefficient.isOne();
    }
    isConstant() {
        return this.input.isConstant();
    }
    negative() {
        return this.multiply(Constant.NEGATIVE);
    }
    derivative() {
        if(this.isConstant()) return Constant.ZERO;

        //chain rule table, coeffcient and exponent const
        ////////////////fweufiewufgiewugfuiwefgwe wrong
        switch(this.name) {
            case "sin": {
                let u = new Function("sin", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Function("cos", this.input, Constant.ONE, Constant.ONE);
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "cos": {
                let u = new Function("cos", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Function("sin", this.input, Constant.NEGATIVE, Constant.ONE);
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "tan": {
                let u = new Function("tan", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Function("sec", this.input, Constant.ONE, new Constant(2));
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "csc": {
                let u = new Function("csc", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Operator("*",
                    new Function("csc", this.input, Constant.NEGATIVE, Constant.ONE),
                    new Function("cot", this.input)
                );
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "sec": {
                let u = new Function("sec", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Operator("*",
                    new Function("sec", this.input),
                    new Function("tan", this.input)
                );
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "cot": {
                let u = new Function("cot", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Function("csc", this.input, Constant.NEGATIVE, new Constant(2));
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            case "ln": {
                let u = new Operator("/", this.coefficient.multiply(this.exponent), this.input);
                let v = this.input.derivative();
                return new Operator("*", u, v);
            }
            case "exp": {
                //e
                let u = new Function("exp", this.input, this.coefficient.multiply(this.exponent), this.exponent.subtract(Constant.ONE));
                let v = new Function("exp", this.input);
                let z = this.input.derivative();
                
                return new Operator("*",
                    new Operator("*", u, v),
                    z
                );
            }
            /*
            get rid of sqrt, replace with 1/2 expo
            case "arcsin": {
                let u = new Operator("/",
                    this.coefficient.multiply(this.exponent),
                    new Function("sqrt", new Operator("-", Constant.ONE, new Power(this.input, new Constant(2))))
                );
                let z = this.input.derivative();
                
                return new Operator("*", u, z);
            }
            case "arccos": {
                let u = new Operator("/",
                    this.coefficient.multiply(this.exponent).multiply(Constant.NEGATIVE),
                    new Function("sqrt", new Operator("-", Constant.ONE, new Power(this.input, new Constant(2))))
                );
                let z = this.input.derivative();
                
                return new Operator("*", u, z);
            }*/
            case "arctan": {
                let u = new Operator("/",
                    this.coefficient.multiply(this.exponent),
                    new Operator("+", Constant.ONE, new Power(this.input, new Constant(2)))
                );
                let z = this.input.derivative();
                
                return new Operator("*", u, z);
            }
        }
        console.error("unknown function", this.name)
        return Constant.ZERO;
    }
    integral() {
        
    }
    add(node) {
        if (!node) return this;
        if (node.type === "constant" && node.isZero()) return this;
        
        if (node.type === "function" && 
            this.name === node.name && 
            this.input.toString() === node.input.toString() && 
            this.exponent.toString() === node.exponent.toString()) {
            return new Function(
                this.name,
                this.input,
                this.coefficient.add(node.coefficient),
                this.exponent
            );
        }
        return new Operator("+", this, node);
    }

    subtract(node) {
        if (!node) return this;
        if (node.type === "constant" && node.isZero()) return this;
        
        if (node.type === "function" && 
            this.name === node.name && 
            this.input.toString() === node.input.toString() && 
            this.exponent.toString() === node.exponent.toString()) {
            return new Function(
                this.name,
                this.input,
                this.coefficient.subtract(node.coefficient),
                this.exponent
            );
        }
        return new Operator("-", this, node);
    }

    multiply(node) {
        if (!node) return this;
        if(this.exponent.isZero()) return node.multiply(this.coefficient);
        switch (node.type) {
            case "constant":
                return new Function(
                    this.name,
                    this.input,
                    this.coefficient.multiply(node),
                    this.exponent
                );
            case "function":
                if (this.name === node.name && 
                    this.input.toString() === node.input.toString()) {
                    return new Function(
                        this.name,
                        this.input,
                        this.coefficient.multiply(node.coefficient),
                        this.exponent.add(node.exponent)
                    );
                }
                return new Operator("*", this, node);
            case "variable":
                return new Function(
                    this.name,
                    this.input,
                    node.multiply(this.coefficient),
                    this.exponent,
                );
            default:
                return new Operator("*", this, node);
        }
    }

    divide(node) {
        if (!node) return this;
        if (node.isZero()) throw new Error("Division by zero");
        if(this.exponent.isZero()) return this.coefficient.divide(node);
        switch (node.type) {
            case "constant":
                return new Function(
                    this.name,
                    this.input,
                    this.coefficient.divide(node),
                    this.exponent
                );
            case "function":
                if (this.name === node.name && 
                    this.input.toString() === node.input.toString()) {
                    return new Function(
                        this.name,
                        this.input,
                        this.coefficient.divide(node.coefficient),
                        this.exponent.subtract(node.exponent)
                    );
                }
                return new Operator("/", this, node);
            default:
                return new Operator("/", this, node);
        }
    }

    power(node) {
        if (!node) return this;
        if(this.exponent.isZero()) return Constant.ONE;
        switch (node.type) {
            case "constant":
                return new Function(
                    this.name,
                    this.input,
                    this.coefficient.power(node),
                    this.exponent.multiply(node)
                );
            default:
                return new Operator("^", this, node);
        }
    }
    toString() {
        let prefix = this.coefficient.type === "constant" && this.coefficient.value === 1 ? "" : this.coefficient.toString();
        let suffix = this.exponent.type === "constant" && this.exponent.value === 1 ? "" : `^(${this.exponent.toString()})`;
        return `${prefix}${this.name}(${this.input.toString()})${suffix}`;
    }
}

module.exports = {
    Node,
    Constant,
    Variable,
    Operator,
    Function,
};





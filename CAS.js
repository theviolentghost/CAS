const {Node, Constant, Variable, Function, Operator} = require("./node.js");

//let a = new Function("sin", new Function("sin", new Variable("x", new Constant(2), new Constant(3))), Constant.ONE, new Constant(5));
//let c = new Constant(4/5);
//let b = new Variable("x", undefined, new Variable("x", undefined, Variable.X));
// let d = new Operator("+", new Variable("x", Constant.ONE, new Constant(2)), new Variable("x", Constant.ONE, new Constant(2)));
// console.log(d.simplify().toString())

//console.log(b.derivative().toString());
//console.log(c.fraction().display);

//console.log(new Variable("x", undefined, new Constant(2)).power(new Constant(2)));

//goes through grabbing terms to "simplify them"
class Crawler {
    terms = [];
    oppositeTerms = [];
    operator = null;
    childrenCrawlers = [];

    constructor(node = null) {
        if (node) {
            this.crawl(node);
        }
    }

    crawl(node, oppositeOperator = false) {
        if (!node) return;

        switch (node.type) {
            case "operator":
                this.crawlOperator(node);
                break;
            case "constant":
            case "variable":
            case "function":
                if(!oppositeOperator) this.terms.push(node);
                else this.oppositeTerms.push(node);
                break;
            default:
                console.error("Unknown node type:", node.type);
        }
    }

    crawlOperator(node) {
        // Set operator if not set
        if (!this.operator) this.operator = node.operator;

        if (this.isCompatibleOperator(node.operator)) {
            // Compatible operator - crawl both sides
            this.crawl(node.left, false);
            this.crawl(node.right, this.isOppositeOperation(node.operator));
        } else {
            // Incompatible operator - treat whole subtree as a term
            const crawler = new Crawler(node);
            this.terms.push(crawler);
            this.childrenCrawlers.push(crawler);
        }
    }

    compatibleMap = [
        ["+", "-"],
        ["*", "/"],
        ["^"] //havnt implement this case fully
    ]

    isOppositeOperation(operator) {
        if (!operator) return false;

        return this.compatibleMap.some(group => {
            return operator === group?.[1]
        });
    }

    isCompatibleOperator(operator) {
        if (!this.operator) return true;
        if (!this.compatibleMap.flat().includes(operator)) return true;

        return this.compatibleMap.some(group => 
            group.includes(this.operator) && group.includes(operator)
        );
    }
}

class Tree {
    root = null;

    constructor(tokens) {
        this.tokens = tokens;
        this.root = this.parseTokens(tokens);
    }

    // Main parsing function that converts tokens to a node tree
    parseTokens(tokens) {
        if (!tokens || tokens.length === 0) return null;

        // Create a parsing context to track position
        const context = {
            tokens: tokens,
            position: 0
        };

        return this.parseExpression(context);
    }

    // Parse a complete expression, handling operator precedence
    parseExpression(context, minPrecedence = 0) {
        let left = this.parsePrimary(context);

        while (context.position < context.tokens.length) {
            const token = context.tokens[context.position];
            
            // Break if we hit a closing bracket or have lower precedence
            if (token.type === 'bracket' && (token.value === ')' || token.value === ']' || token.value === '}')) {
                break;
            }

            if (token.type === 'separator') {
                break;
            }

            if (token.type !== 'operator') {
                break;
            }

            const precedence = this.getOperatorPrecedence(token.value);
            if (precedence < minPrecedence) {
                break;
            }

            // Consume the operator token
            context.position++;

            // Parse the right side of the expression
            const right = this.parseExpression(context, precedence + 1);

            // Create a new operator node
            left = new Operator(token.value, left, right);
        }

        return left;
    }

    // Parse primary expressions (numbers, variables, functions, parenthesized expressions)
    parsePrimary(context) {
        const token = context.tokens[context.position];
        
        if (!token) {
            throw new Error("Unexpected end of expression");
        }

        // Handle numbers
        if (token.type === 'number') {
            context.position++;
            return new Constant(token.value);
        }

        // Handle variables
        if (token.type === 'variable') {
            context.position++;
            return new Variable(token.value);
        }

        // Handle functions
        if (token.type === 'function') {
            return this.parseFunction(context);
        }

        // Handle parenthesized expressions
        if (token.type === 'bracket' && (token.value === '(' || token.value === '[' || token.value === '{')) {
            context.position++; // Skip opening bracket
            const expression = this.parseExpression(context);
            
            // Ensure we have a closing bracket
            const closingToken = context.tokens[context.position];
            if (!closingToken || closingToken.type !== 'bracket' || 
                !this.isMatchingBracket(token.value, closingToken.value)) {
                throw new Error("Missing closing bracket");
            }
            
            context.position++; // Skip closing bracket
            return expression;
        }

        throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
    }

    // Parse function calls
    parseFunction(context) {
        const token = context.tokens[context.position];
        context.position++; // Consume function name

        // Ensure we have an opening bracket
        const openBracket = context.tokens[context.position];
        if (!openBracket || openBracket.type !== 'bracket' || 
            (openBracket.value !== '(' && openBracket.value !== '[' && openBracket.value !== '{')) {
            throw new Error("Expected opening bracket after function name");
        }
        context.position++; // Skip opening bracket

        // Parse function arguments
        const args = this.parseFunctionArguments(context);

        // Ensure we have a closing bracket
        const closeBracket = context.tokens[context.position];
        if (!closeBracket || closeBracket.type !== 'bracket' || 
            !this.isMatchingBracket(openBracket.value, closeBracket.value)) {
            throw new Error("Missing closing bracket for function");
        }
        context.position++; // Skip closing bracket

        // Create function node with arguments
        return new Function(token.value.toLowerCase(), args[0]); // Assuming single argument functions for now
    }

    // Parse function arguments (comma-separated expressions)
    parseFunctionArguments(context) {
        const args = [];
        
        while (context.position < context.tokens.length) {
            const arg = this.parseExpression(context);
            args.push(arg);

            const token = context.tokens[context.position];
            if (!token || token.type === 'bracket') break;
            
            if (token.type !== 'separator') {
                throw new Error("Expected comma between function arguments");
            }
            
            context.position++; // Skip comma
        }

        return args;
    }

    // Helper method to get operator precedence
    getOperatorPrecedence(operator) {
        const precedence = {
            '+': 1,
            '-': 1,
            '*': 2,
            '/': 2,
            '^': 3
        };
        return precedence[operator] || 0;
    }

    // Helper method to check if brackets match
    isMatchingBracket(open, close) {
        return (open === '(' && close === ')') ||
               (open === '[' && close === ']') ||
               (open === '{' && close === '}');
    }

    reduce(node) {
        if(!node) return;

        if(Node.isOperator(node)) {
            node._left = this.reduce(node.left);
            node._right = this.reduce(node.right);

            switch(node.operator) {
                case "+": 
                    if(node.left.isZero()) return node.right;
                    if(node.right.isZero()) return node.left;
                    return node.left.add(node.right); //attempt to combine
                case "-":
                    if(node.left.isZero()) return node.right.multiply(Constant.NEGATIVE);
                    if(node.right.isZero()) return node.left;
                    return node.left.subtract(node.right);
                case "*":
                    if(node.left.isZero() || node.right.isZero()) return Constant.ZERO;
                    if(node.left.isOne()) return node.right;
                    if(node.right.isOne()) return node.left;
                    return node.left.multiply(node.right);
                case "/":
                    if(node.left.isZero()) return Constant.ZERO;
                    if(node.right.isZero()) {
                        console.error("deviding by zero", node);
                        return Constant.ZERO;
                    }
                    if(node.right.isOne()) return node.left;
                    return node.left.divide(node.right);
                case "^":
                    if(node.right.isZero()) return Constant.ONE;
                    if(node.right.isOne()) return node.left;
                    return node.left.power(node.right);
            }
        }

        return node;
    }

    simplify(root = this.root) {
        const reducedRoot = this.reduce(root);
        console.log(reducedRoot);

        const crawler = new Crawler(reducedRoot);

        console.log(crawler);

        while(true) {
            let a;
        }

        return null;
    }

    distribute() {
        
        return this;
    }
}
















///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class Expression {
    expression = "";
    tokens = [];
    tree = null;

    constructor(expression) {
        this.expression = expression.replace(/\s+/g, ''); 
        this.isValid = this.validateExpression();
        if (this.isValid) {
            this.tokens = this.tokenize();
            this.tree = new Tree(this.tokens);
        }
    }

    containers = [
        {open: "(", close: ")"},
        {open: "[", close: "]"},
        {open: "{", close: "}"},
    ];
    //their precedence
    operators = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
        '^': 3,
    };
    getPrecedence(operator) {
        return this.operators[operator] || 0;
    }
    functions = Function.functions;
    validateExpression() {
        if (!this.expression) return false;

        // Check for valid container pairs
        const stack = [];
        const openBrackets = this.containers.map(c => c.open);
        const closeBrackets = this.containers.map(c => c.close);
        
        for (let char of this.expression) {
            if (openBrackets.includes(char)) {
                stack.push(char);
            } else if (closeBrackets.includes(char)) {
                const expectedOpen = this.containers[closeBrackets.indexOf(char)].open;
                if (stack.pop() !== expectedOpen) return false;
            }
        }
        
        if (stack.length > 0) return false;

        // Check for invalid character sequences
        const validChars = /^[a-zA-Z0-9+\-*/^().[\]{},\s]+$/;
        if (!validChars.test(this.expression)) return false;

        // Check for consecutive operators
        const consecutiveOperators = /[\+\-\*\/\^]{2,}/;
        if (consecutiveOperators.test(this.expression)) return false;

        // Check for valid function names
        const functionMatches = this.expression.match(/[a-zA-Z]+/g) || [];
        for (let match of functionMatches) {
            if (match.length > 1 && !this.functions.includes(match.toLowerCase())) {
                // Allow single-letter variables like x, y, z
                if (match.length > 1) return false;
            }
        }

        return true;
    }
    tokenize() {
        const tokens = [];
        let current = '';
        let i = 0;

        const isDigit = (char) => /[0-9.]/.test(char);
        const isLetter = (char) => /[a-zA-Z]/.test(char);
        const isOperator = (char) => /[\+\-\*\/\^]/.test(char);
        const isBracket = (char) => /[\(\)\[\]\{\}]/.test(char);

        while (i < this.expression.length) {
            let char = this.expression[i];

            // Handle numbers (including decimals)
            if (isDigit(char)) {
                current = '';
                while (i < this.expression.length && isDigit(this.expression[i])) {
                    current += this.expression[i];
                    i++;
                }
                tokens.push({
                    type: 'number',
                    value: parseFloat(current)
                });
                continue;
            }

            // Handle variables and functions
            if (isLetter(char)) {
                current = '';
                while (i < this.expression.length && isLetter(this.expression[i])) {
                    current += this.expression[i];
                    i++;
                }
                // Check if it's a function or variable
                tokens.push({
                    type: this.functions.includes(current.toLowerCase()) ? 'function' : 'variable',
                    value: current
                });
                continue;
            }

            // Handle operators
            if (isOperator(char)) {
                // Handle unary operators
                if (char === '-' && (tokens.length === 0 || 
                    tokens[tokens.length - 1].type === 'operator' || 
                    tokens[tokens.length - 1].value === '(')) {
                    tokens.push({
                        type: 'number',
                        value: -1
                    });
                    tokens.push({
                        type: 'operator',
                        value: '*'
                    });
                } else {
                    tokens.push({
                        type: 'operator',
                        value: char
                    });
                }
                i++;
                continue;
            }

            // Handle brackets
            if (isBracket(char)) {
                tokens.push({
                    type: 'bracket',
                    value: char
                });
                i++;
                continue;
            }

            // Handle commas (for function arguments)
            if (char === ',') {
                tokens.push({
                    type: 'separator',
                    value: char
                });
                i++;
                continue;
            }

            // Skip whitespace
            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Invalid character
            throw new Error(`Invalid character found: ${char}`);
        }

        return tokens;
    }
    log() {
        console.log(this.expression);
    }
    simplify() {
        this.tree.simplify();
    }
}

module.exports = {
    Expression,
};
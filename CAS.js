const {Node, Constant, Variable, Function, Operator} = require("./node.js");

//let a = new Function("sin", new Function("sin", new Variable("x", new Constant(2), new Constant(3))), Constant.ONE, new Constant(5));
//let c = new Constant(4/5);
//let b = new Variable("x", undefined, new Variable("x", undefined, Variable.X));
// let d = new Operator("+", new Variable("x", Constant.ONE, new Constant(2)), new Variable("x", Constant.ONE, new Constant(2)));
// console.log(d.simplify().toString())
//let e = new Operator("/", Variable.X, new Variable("x", Constant.ONE, new Constant(2)))

//console.log(e.derivative().toString());
//console.log(c.fraction().display);

//console.log(new Variable("x", undefined, new Constant(2)).power(new Constant(2)));

//goes through grabbing terms to "simplify them"
class Crawler {
    type = "crawler";
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
                this.crawlOperator(node, oppositeOperator);
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

    crawlOperator(node, oppositeOperator = false) {
        // Set operator if not set
        if (!this.operator) this.assignOperatorFromNode(node);

        if (this.isCompatibleOperator(node.operator)) {
            // Compatible operator - crawl both sides
            this.crawl(node.left, false);
            this.crawl(node.right, this.isOppositeOperation(node.operator));
        } else {
            // Incompatible operator - treat whole subtree as a term
            const crawler = new Crawler(node);
            
            if(!oppositeOperator) this.terms.push(crawler);
            else this.oppositeTerms.push(crawler);

            this.childrenCrawlers.push(crawler);
        }
    }

    get compatibleMap() {
        return [
            ["+", "-", Constant.ZERO], //index #2 is what is retunred on cancel, ex: x / x = 1;
            ["*", "/", Constant.ONE],
            ["^", "###", Constant.ONE] //havnt implement this case fully
        ];
    } 

    isOppositeOperation(operator) {
        if (!operator) return false;

        return this.compatibleMap.some(group => {
            return operator === group?.[1]
        });
    }

    assignOperatorFromNode(node) {
        let operatorToSet = null;
        let oppositeOperatorToSet = null;

        for (let i = 0; i < this.compatibleMap.length; i++) {
            // Check if the operator is in the current group
            if (this.compatibleMap[i].includes(node.operator)) {
                // Return the first index of the group
                operatorToSet = this.compatibleMap[i][0];
                oppositeOperatorToSet = this.compatibleMap[i][1];
            }
        }

        this.operator = operatorToSet;
        this.oppositeOperator = oppositeOperatorToSet;
    }

    isCompatibleOperator(operator) {
        if (!this.operator) return true;
        if (!this.compatibleMap.flat().includes(operator)) return true;

        return this.compatibleMap.some(group => 
            group.includes(this.operator) && group.includes(operator)
        );
    }
    convertToTerm() {
        //used as term key
        let termsString = this.terms.map((term) => term.toString()).join(this.operator);

        if(this.oppositeTerms.length === 0) return `${termsString}`;

        let oppositeTermsString = this.oppositeTerms.map((term) => term.toString()).join(this.operator);

        return `${termsString}${this.oppositeOperator}${oppositeTermsString}`;
    }
    toString() {
        return this.convertToTerm();
    }
    orderTerms() {
        //order them so if identical crawler exists their termKey will be identical
        //use operator.orderTemrs();
        this.terms.sort((a,b) => {
            if(a.type === "crawler") a.orderTerms();
            if(b.type === "crawler") b.orderTerms();
            return Operator.orderTerms(a,b)
        });
        this.oppositeTerms.sort((a,b) => {
            if(a.type === "crawler") a.orderTerms();
            if(b.type === "crawler") b.orderTerms();
            return Operator.orderTerms(a,b)
        });
    }
    reduce() {
        //sorts terms
        this.orderTerms();
        //reduces all sub instances of crawlers
        for(let crawler of this.childrenCrawlers) {
            crawler.reduce();
        }

        //termification and simplification
        const termified = {
            terms: this.terms.map((node) => node.toString()),
            inverse: this.oppositeTerms.map((node) => node.toString())
        }

        for(let n = 0; n < termified.terms.length; n++) {
            for(let m = 0; m < termified.inverse.length; m++) {
                if(termified.terms[n] === termified.inverse[m]) {
                    this.oppositeTerms.splice(m,1);
                    termified.terms.splice(n,1);
                    termified.inverse.splice(m,1);
                    this.terms[n] = this.compatibleMap.filter(group => {
                        return this.operator === group?.[0] || this.operator === group?.[1]
                    })[0][2]; //replaces term with appropriate simplified term
                    m--;
                    n--;
                }
            }
        }
          
        //combines any like terms
        for(let t = 0; t < this.terms.length; t++) {
            //not minus one to check against opposite terms
            let term = this.terms[t];

            for(let i = 0; i < this.oppositeTerms.length; i++) {
                let oppositeTerm = this.oppositeTerms[i];
                if(Operator.canCombine(this.operator,term,oppositeTerm)) {
                    this.terms.splice(t+1, 1);
                    this.terms[t] = new Operator(this.oppositeOperator, term, oppositeTerm).simplify();
                    this.oppositeTerms.splice(i--,1);
                }
            }

            if(!(t < this.terms.length - 1)) break; //stop errors

            let nextTerm = this.terms[t+1];

            if(Operator.canCombine(this.operator,term,nextTerm)) {
                this.terms.splice(t+1, 1);
                this.terms[t--] = new Operator(this.operator, term, nextTerm).simplify();
            }
        }
        for(let t = 0; t < this.oppositeTerms.length - 1; t++) {
            let term = this.oppositeTerms[t];
            let nextTerm = this.oppositeTerms[t+1];
            if(Operator.canCombine(this.operator,term,nextTerm)) {
                this.oppositeTerms.splice(t+1, 1);
                this.oppositeTerms[t--] = new Operator(this.operator, term, nextTerm).simplify();
            }
        }
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

    reduce(node, allowDistributing = true) {
        if(!node) return;

        if(Node.isOperator(node)) {
            node._left = this.reduce(node.left, allowDistributing);
            node._right = this.reduce(node.right, allowDistributing);

            const isOneOperandAnOperator = Node.isOperator(node.left) || Node.isOperator(node.right);

            switch(node.operator) {
                case "+": 
                    if(node.left.isZero()) return node.right;
                    if(node.right.isZero()) return node.left;
                    if(!allowDistributing && isOneOperandAnOperator) return node; //prevents distributing
                    return node.left.add(node.right); //attempt to combine
                case "-":
                    if(node.left.isZero()) return node.right.multiply(Constant.NEGATIVE);
                    if(node.right.isZero()) return node.left;
                    if(!allowDistributing && isOneOperandAnOperator) return node; //prevents distributing
                    return node.left.subtract(node.right);
                case "*":
                    if(node.left.isZero() || node.right.isZero()) return Constant.ZERO;
                    if(node.left.isOne()) return node.right;
                    if(node.right.isOne()) return node.left;
                    if(!allowDistributing && isOneOperandAnOperator) return node; //prevents distributing
                    return node.left.multiply(node.right);
                case "/":
                    if(node.left.isZero()) return Constant.ZERO;
                    if(node.right.isZero()) {
                        console.error("deviding by zero", node);
                        return Constant.ZERO;
                    }
                    if(node.right.isOne()) return node.left;
                    if(!allowDistributing && isOneOperandAnOperator) return node; //prevents distributing
                    return node.left.divide(node.right);
                case "^":
                    if(node.right.isZero()) return node.left.coefficient || Constant.ONE;
                    if(node.right.isOne()) return node.left;
                    return node.left.power(node.right);
            }
        }

        return node;
    }

    simplify(root = this.root) {
        const reducedRoot = this.reduce(root, false);
        //console.log(reducedRoot);

        const crawler = new Crawler(reducedRoot);
        crawler.reduce();

        //console.log(crawler);

        return {
            root: reducedRoot,
            crawler,
            //expression: new Expression(crawler.toString()),
            string: crawler.toString()
        };
    }

    distribute() {
        
        return this;
    }

    derivative() {
        return this.simplify(
            this.simplify().root.derivative()
        );
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
        else console.error("not valid equation", this.expression);
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
        let i = 0;

        const isDigit = (char) => /[0-9]/.test(char);
        const isLetter = (char) => /[a-zA-Z]/.test(char);
        const isOperator = (char) => /[\+\-\*\/\^]/.test(char);
        const isBracket = (char) => /[\(\)\[\]\{\}]/.test(char);

        while (i < this.expression.length) {
            let char = this.expression[i];

            // Skip whitespace
            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Handle numbers (including decimals)
            if (isDigit(char)) {
                let number = '';
                while (i < this.expression.length && (isDigit(this.expression[i]) || this.expression[i] === '.')) {
                    number += this.expression[i];
                    i++;
                }
                
                tokens.push({
                    type: 'number',
                    value: parseFloat(number)
                });

                // Check for implicit multiplication
                if (i < this.expression.length && (isLetter(this.expression[i]) || this.expression[i] === '(')) {
                    tokens.push({
                        type: 'operator',
                        value: '*'
                    });
                }
                continue;
            }

            // Handle variables and functions
            if (isLetter(char)) {
                let name = '';
                while (i < this.expression.length && isLetter(this.expression[i])) {
                    name += this.expression[i];
                    i++;
                }

                // Check if it's a function or variable
                tokens.push({
                    type: this.functions.includes(name.toLowerCase()) ? 'function' : 'variable',
                    value: name
                });

                // Add implicit multiplication if followed by another variable or number
                if (i < this.expression.length && (isDigit(this.expression[i]) || isLetter(this.expression[i]))) {
                    tokens.push({
                        type: 'operator',
                        value: '*'
                    });
                }
                continue;
            }

            // Handle operators
            if (isOperator(char)) {
                // Handle unary minus
                if (char === '-' && (tokens.length === 0 || 
                    tokens[tokens.length - 1].type === 'operator' || 
                    (tokens[tokens.length - 1].type === 'bracket' && 
                     ['(', '[', '{'].includes(tokens[tokens.length - 1].value)))) {
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
                
                // Add implicit multiplication after closing bracket if followed by variable or number
                if (char === ')' && i + 1 < this.expression.length && 
                    (isDigit(this.expression[i + 1]) || isLetter(this.expression[i + 1]))) {
                    tokens.push({
                        type: 'operator',
                        value: '*'
                    });
                }
                i++;
                continue;
            }

            // Handle commas
            if (char === ',') {
                tokens.push({
                    type: 'separator',
                    value: char
                });
                i++;
                continue;
            }

            throw new Error(`Invalid character found: ${char}`);
        }

        return tokens;
    }
    
    log() {
        console.log(this.expression);
    }
    simplify() {
        if (!this.isValid) return;
        this.tree.simplify();
    }
    derivative() {
        if (!this.isValid) return;
        return this.tree.derivative();
    }
}

module.exports = {
    Expression,
};
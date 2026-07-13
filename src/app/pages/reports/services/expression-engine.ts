export class ExpressionEngine {
  
  static evaluate(expression: string, context: any): any {
    if (!expression) return null;

    try {
      // 1. Resolve Variables
      // Replace variables with their values from the context.
      // This is a naive implementation; a real implementation should use a proper parser (e.g., jsep)
      let evaluatedExpr = expression;
      
      const variableRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
      const functions = ['CONCAT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'IF', 'TODAY', 'YEAR', 'MONTH', 'DAY', 'DATE_DIFF', 'ROUND', 'UPPER', 'LOWER'];
      
      const tokens = Array.from(new Set(expression.match(variableRegex) || []));
      
      // Basic function evaluation logic placeholder
      if (expression.startsWith('CONCAT(')) {
        return this.evaluateConcat(expression, context);
      }
      if (expression.startsWith('IF(')) {
        return this.evaluateIf(expression, context);
      }
      
      // Fallback for simple arithmetic (not recommended for production without a real parser, but avoids eval)
      // For now we just return a placeholder or do very basic parsing.
      // E.g., 'Total Fees - Paid Fees'
      if (expression.includes('-')) {
        const parts = expression.split('-');
        if (parts.length === 2) {
          const val1 = this.getValue(parts[0].trim(), context);
          const val2 = this.getValue(parts[1].trim(), context);
          if (typeof val1 === 'number' && typeof val2 === 'number') {
            return val1 - val2;
          }
        }
      }

      if (expression.includes('+')) {
         const parts = expression.split('+');
         if (parts.length === 2) {
            const val1 = this.getValue(parts[0].trim(), context);
            const val2 = this.getValue(parts[1].trim(), context);
            return Number(val1) + Number(val2);
         }
      }

      return this.getValue(expression.trim(), context);
    } catch (e) {
      console.warn('Failed to evaluate expression:', expression, e);
      return null;
    }
  }

  private static getValue(key: string, context: any): any {
    // Handle string literals
    if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
      return key.substring(1, key.length - 1);
    }
    
    // Handle numbers
    if (!isNaN(Number(key))) {
      return Number(key);
    }

    return context[key];
  }

  private static evaluateConcat(expr: string, context: any): string {
    const inner = expr.substring(7, expr.length - 1);
    const parts = inner.split(',').map(p => p.trim());
    return parts.map(p => this.getValue(p, context)).join('');
  }

  private static evaluateIf(expr: string, context: any): any {
    const inner = expr.substring(3, expr.length - 1);
    const parts = inner.split(',').map(p => p.trim());
    if (parts.length === 3) {
      const condition = this.evaluateCondition(parts[0], context);
      return condition ? this.getValue(parts[1], context) : this.getValue(parts[2], context);
    }
    return null;
  }

  private static evaluateCondition(cond: string, context: any): boolean {
    if (cond.includes('=')) {
      const parts = cond.split('=');
      return this.getValue(parts[0].trim(), context) == this.getValue(parts[1].trim(), context);
    }
    if (cond.includes('>')) {
      const parts = cond.split('>');
      return this.getValue(parts[0].trim(), context) > this.getValue(parts[1].trim(), context);
    }
    if (cond.includes('<')) {
      const parts = cond.split('<');
      return this.getValue(parts[0].trim(), context) < this.getValue(parts[1].trim(), context);
    }
    return !!this.getValue(cond.trim(), context);
  }
}

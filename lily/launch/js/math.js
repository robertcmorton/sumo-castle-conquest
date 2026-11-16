// Generates a math question whose difficulty scales with level.
// Returns { question: string, answer: number }.
const MathGate = {
  generate(level) {
    if (level <= 1) return this.addition(1);
    if (level <= 2) return this.addition(2);
    if (level <= 3) return this.subtraction(1);
    if (level <= 4) return this.subtraction(2);
    if (level <= 5) return this.mixed(level);
    if (level <= 6) return this.mixed(level);
    if (level <= 8) return this.multiplication(level);
    if (level <= 10) return this.division(level);
    return this.wordProblem(level);
  },

  addition(tier) {
    const max = tier <= 1 ? 10 : 25;
    const a = rand(1, max);
    const b = rand(1, max);
    return { question: `${a} + ${b} = ?`, answer: a + b };
  },

  subtraction(tier) {
    const max = tier <= 1 ? 20 : 60;
    const a = rand(2, max);
    const b = rand(1, a);
    return { question: `${a} − ${b} = ?`, answer: a - b };
  },

  mixed(level) {
    if (Math.random() < 0.5) {
      const a = rand(10, 60);
      const b = rand(10, 60);
      return { question: `${a} + ${b} = ?`, answer: a + b };
    }
    const a = rand(30, 99);
    const b = rand(1, a);
    return { question: `${a} − ${b} = ?`, answer: a - b };
  },

  multiplication(level) {
    const max = level <= 7 ? 10 : 12;
    const a = rand(2, max);
    const b = rand(2, max);
    return { question: `${a} × ${b} = ?`, answer: a * b };
  },

  division(level) {
    const max = level <= 9 ? 10 : 12;
    const divisor = rand(2, max);
    const result = rand(2, max);
    return { question: `${divisor * result} ÷ ${divisor} = ?`, answer: result };
  },

  wordProblem(level) {
    const builders = [
      () => {
        const apples = rand(8, 25);
        const eaten = rand(1, apples - 1);
        return {
          question: `Sam has ${apples} apples and eats ${eaten}. How many are left?`,
          answer: apples - eaten
        };
      },
      () => {
        const boxes = rand(3, 9);
        const each = rand(3, 12);
        return {
          question: `There are ${boxes} boxes with ${each} toys in each. How many toys altogether?`,
          answer: boxes * each
        };
      },
      () => {
        const groups = [2, 3, 4, 5, 6][rand(0, 4)];
        const result = rand(3, 10);
        return {
          question: `Share ${groups * result} sweets equally between ${groups} friends. How many each?`,
          answer: result
        };
      },
      () => {
        const a = rand(15, 45);
        const b = rand(10, 35);
        return {
          question: `A train has ${a} passengers. ${b} more get on. How many now?`,
          answer: a + b
        };
      },
      () => {
        const minutes = rand(2, 9);
        const perMin = rand(3, 8);
        return {
          question: `A printer makes ${perMin} copies a minute. How many in ${minutes} minutes?`,
          answer: perMin * minutes
        };
      }
    ];
    return builders[rand(0, builders.length - 1)]();
  }
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

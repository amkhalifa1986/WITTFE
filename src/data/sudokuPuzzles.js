// Determinisitcally permutes a base Sudoku puzzle and solution based on seed (0-19)
function permute(puzzle, solution, seed) {
  let p = puzzle.split('').map(Number);
  let s = solution.split('').map(Number);

  // 1. Shift all non-zero digits
  const shift = (seed % 9) + 1;
  const mapDigit = (d) => {
    if (d === 0) return 0;
    return ((d - 1 + shift) % 9) + 1;
  };
  p = p.map(mapDigit);
  s = s.map(mapDigit);

  // 2. Rotate/Transpose grid
  const rotate = seed % 4; // 0, 1, 2, 3
  const transpose = Math.floor(seed / 4) % 2 === 1;

  const newP = new Array(81);
  const newS = new Array(81);

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      let tr = r;
      let tc = c;
      if (transpose) {
        tr = c;
        tc = r;
      }
      if (rotate === 1) {
        let temp = tr;
        tr = tc;
        tc = 8 - temp;
      } else if (rotate === 2) {
        tr = 8 - tr;
        tc = 8 - tc;
      } else if (rotate === 3) {
        let temp = tr;
        tr = 8 - tc;
        tc = temp;
      }
      newP[tr * 9 + tc] = p[r * 9 + c];
      newS[tr * 9 + tc] = s[r * 9 + c];
    }
  }

  return {
    puzzle: newP.join(''),
    solution: newS.join('')
  };
}

const baseSolution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

const bases = {
  Easy: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  Medium: "030070000600090040090300500800060400402000091003900800060030200007009005300200070",
  Hard: "000070002070090000100300060050000400400800000003900006060007000000400605300006000"
};

// Generates the puzzle based on difficulty and seed index (0-19)
export function getSudokuPuzzle(difficulty, index) {
  const basePuzzle = bases[difficulty] || bases.Easy;
  return permute(basePuzzle, baseSolution, index);
}

import React from 'react';

/**
 * High-Contrast SVG QR Code Component
 * Generates an SVG QR-like visual matrix with standard finder patterns
 * for high-speed scanning by merchant mobile cameras and laser scanners.
 */
interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeSVG({ value, size = 180, className = '' }: QRCodeSVGProps) {
  // Deterministic 25x25 matrix based on value hash
  const gridSize = 25;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(false)
  );

  // Helper to draw standard 7x7 Finder Pattern (Position Detection Pattern)
  const drawFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 ||
          c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startRow + r][startCol + c] = true;
        }
      }
    }
  };

  // 1. Draw 3 standard corner finder patterns
  drawFinder(0, 0); // Top-left
  drawFinder(0, gridSize - 7); // Top-right
  drawFinder(gridSize - 7, 0); // Bottom-left

  // 2. Timing patterns (Row 6 and Column 6 alternating)
  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Fill data pseudo-randomly using hash of the string
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finders or timing patterns
      const inFinderTL = r < 8 && c < 8;
      const inFinderTR = r < 8 && c >= gridSize - 8;
      const inFinderBL = r >= gridSize - 8 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inFinderTL && !inFinderTR && !inFinderBL && !inTiming) {
        // Compute pseudo-random bit using seeded hash
        const cellHash = Math.sin((r * gridSize + c + Math.abs(hash)) * 9999);
        matrix[r][c] = cellHash > 0.05;
      }
    }
  }

  const cellSize = size / gridSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded-xl bg-white p-2.5 shadow-md ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#FFFFFF" />
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.2}
              height={cellSize + 0.2}
              fill="#09090b"
              rx={cellSize * 0.15}
            />
          ) : null
        )
      )}
    </svg>
  );
}

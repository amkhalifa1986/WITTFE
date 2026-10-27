import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePopup } from '../context/PopupContext';
import { AdInterstitial } from '../components/AdInterstitial';
import api from '../services/api';
import { getSudokuPuzzle } from '../data/sudokuPuzzles';
import { 
  Gamepad2, Play, Pause, Trash2, Trophy, Clock, 
  RotateCcw, CheckCircle2, ChevronRight, Award, HelpCircle, Delete
} from 'lucide-react';

export default function Sudoku() {
  const { t, isRTL } = useLanguage();
  const { confirm } = usePopup();
  
  // Game States
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bestTimes, setBestTimes] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardTab, setLeaderboardTab] = useState('Easy');
  const [showCompletion, setShowCompletion] = useState(false);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);

  // Active Game Play States
  const [inGame, setInGame] = useState(false);
  const [puzzleData, setPuzzleData] = useState(null); // { puzzle, solution }
  const [userState, setUserState] = useState(new Array(81).fill(0));
  const [selectedCell, setSelectedCell] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Refs
  const timerRef = useRef(null);
  const autoSaveRef = useRef(null);

  // Fetch initial data (active session, personal bests, leaderboard)
  useEffect(() => {
    fetchInitialData();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(autoSaveRef.current);
    };
  }, []);

  // Fetch leaderboard when tab changes
  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardTab]);

  // Handle active session timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  // Auto-save progress every 30 seconds
  useEffect(() => {
    if (inGame && activeSession && timerRunning) {
      autoSaveRef.current = setInterval(() => {
        saveProgressSilently();
      }, 30000);
    } else {
      clearInterval(autoSaveRef.current);
    }
    return () => clearInterval(autoSaveRef.current);
  }, [inGame, activeSession, timerRunning, userState, elapsedSeconds]);

  // Keyboard navigation and entry
  useEffect(() => {
    if (!inGame || selectedCell === null) return;

    const handleKeyDown = (e) => {
      // Avoid handling if user is typing in some input else
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      const row = Math.floor(selectedCell / 9);
      const col = selectedCell % 9;

      if (e.key === 'ArrowUp' && row > 0) setSelectedCell((row - 1) * 9 + col);
      if (e.key === 'ArrowDown' && row < 8) setSelectedCell((row + 1) * 9 + col);
      if (e.key === 'ArrowLeft') {
        if (isRTL) {
          if (col < 8) setSelectedCell(row * 9 + (col + 1));
        } else {
          if (col > 0) setSelectedCell(row * 9 + (col - 1));
        }
      }
      if (e.key === 'ArrowRight') {
        if (isRTL) {
          if (col > 0) setSelectedCell(row * 9 + (col - 1));
        } else {
          if (col < 8) setSelectedCell(row * 9 + (col + 1));
        }
      }

      // Cell value entry
      const cellIsClue = puzzleData?.puzzle[selectedCell] !== '0';
      if (cellIsClue) return;

      if (e.key >= '1' && e.key <= '9') {
        handleCellInput(selectedCell, parseInt(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleCellInput(selectedCell, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inGame, selectedCell, puzzleData, userState, isRTL]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [sessionRes, bestRes, leaderboardRes] = await Promise.all([
        api.getActiveSudokuSession(),
        api.getSudokuMyBest(),
        api.getSudokuLeaderboard(leaderboardTab)
      ]);

      // 1. Get active session
      if (sessionRes.isSuccess && sessionRes.data) {
        const session = sessionRes.data;
        setActiveSession(session);
        // Load puzzle details
        const puzzle = getSudokuPuzzle(session.difficulty, session.puzzleIndex);
        setPuzzleData(puzzle);
        setElapsedSeconds(session.elapsedSeconds);
        
        // Populate user state (if new session has empty cells "000...", initialize with base puzzle)
        const cellArr = session.cellState.split('').map(Number);
        const hasProgress = cellArr.some(x => x !== 0);
        if (hasProgress) {
          setUserState(cellArr);
        } else {
          setUserState(puzzle.puzzle.split('').map(Number));
        }
      }

      // 2. Get my best times
      if (bestRes.isSuccess && bestRes.data) {
        const dict = {};
        bestRes.data.forEach(item => {
          dict[item.difficulty] = item.bestTimeSeconds;
        });
        setBestTimes(dict);
      }

      // 3. Get leaderboard
      if (leaderboardRes.isSuccess && leaderboardRes.data) {
        setLeaderboard(leaderboardRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch Sudoku initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.getSudokuLeaderboard(leaderboardTab);
      if (res.isSuccess && res.data) {
        setLeaderboard(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const startNewGame = async (difficulty) => {
    if (activeSession) {
      alert(t('mustFinishFirst'));
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.createSudokuSession(difficulty);
      if (res.isSuccess && res.data) {
        const session = res.data;
        setActiveSession(session);
        const puzzle = getSudokuPuzzle(session.difficulty, session.puzzleIndex);
        setPuzzleData(puzzle);
        setUserState(puzzle.puzzle.split('').map(Number));
        setElapsedSeconds(0);
        setInGame(true);
        setTimerRunning(true);
        setSelectedCell(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const resumeActiveGame = () => {
    if (!activeSession) return;
    setInGame(true);
    setTimerRunning(true);
  };

  const saveProgressSilently = async () => {
    if (!activeSession) return;
    try {
      const stateStr = userState.join('');
      await api.updateSudokuProgress(activeSession.id, stateStr, elapsedSeconds);
    } catch (err) {
      console.error('Silent save failed:', err);
    }
  };

  const pauseGame = async () => {
    setTimerRunning(false);
    setLoading(true);
    try {
      const stateStr = userState.join('');
      await api.updateSudokuProgress(activeSession.id, stateStr, elapsedSeconds);
      setInGame(false);
      // Refresh my bests & active session details
      await fetchInitialData();
    } catch (err) {
      alert('Failed to save progress on pause: ' + err.message);
      setTimerRunning(true);
    } finally {
      setLoading(false);
    }
  };

  const discardGame = async () => {
    if (!activeSession) return;
    const isConfirmed = await confirm(t('confirmDiscard'));
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await api.discardSudokuSession(activeSession.id);
      setActiveSession(null);
      setInGame(false);
      setTimerRunning(false);
      setPuzzleData(null);
      setUserState(new Array(81).fill(0));
      setSelectedCell(null);
      setElapsedSeconds(0);
      await fetchInitialData();
    } catch (err) {
      alert('Failed to discard session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCellInput = (index, value) => {
    const isClue = puzzleData?.puzzle[index] !== '0';
    if (isClue) return;

    const newState = [...userState];
    newState[index] = value;
    setUserState(newState);

    // Validate completion immediately when all cells are filled
    const isFullyFilled = newState.every(val => val !== 0);
    if (isFullyFilled) {
      checkCompletion(newState);
    }
  };

  const checkCompletion = async (grid) => {
    const gridStr = grid.join('');
    if (gridStr === puzzleData?.solution) {
      // Solved successfully!
      setTimerRunning(false);
      setSubmitting(true);
      try {
        await api.completeSudokuSession(activeSession.id, elapsedSeconds);
        
        // Check if it's a personal best
        const prevBest = bestTimes[activeSession.difficulty];
        const isBest = !prevBest || elapsedSeconds < prevBest;
        setIsNewPersonalBest(isBest);
        
        setShowCompletion(true);
      } catch (err) {
        alert('Failed to save completed score: ' + err.message);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleCheatSolve = async () => {
    if (window.location.hostname.includes('localhost') && puzzleData?.solution) {
      const solutionGrid = puzzleData.solution.split('').map(Number);
      setUserState(solutionGrid);
      await checkCompletion(solutionGrid);
    }
  };

  const handleCloseCompletion = async () => {
    setShowCompletion(false);
    setActiveSession(null);
    setInGame(false);
    setPuzzleData(null);
    setSelectedCell(null);
    setElapsedSeconds(0);
    await fetchInitialData();
  };

  // Helper formatting hh:mm:ss
  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  // Check conflicts in Sudoku grid
  const hasConflict = (index) => {
    const val = userState[index];
    if (val === 0) return false;
    
    const row = Math.floor(index / 9);
    const col = index % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;

    for (let i = 0; i < 9; i++) {
      // Row conflict
      const rIdx = row * 9 + i;
      if (rIdx !== index && userState[rIdx] === val) return true;

      // Col conflict
      const cIdx = i * 9 + col;
      if (cIdx !== index && userState[cIdx] === val) return true;

      // Box conflict
      const br = boxRow + Math.floor(i / 3);
      const bc = boxCol + (i % 3);
      const bIdx = br * 9 + bc;
      if (bIdx !== index && userState[bIdx] === val) return true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="sudoku-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="loader" style={{ borderTopColor: 'var(--accent-primary)' }}></div>
      </div>
    );
  }

  return (
    <div className="sudoku-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Dynamic Style Injection for Premium Aesthetics */}
      <style>{`
        .sudoku-page {
          animation: fadeIn 0.4s ease-out;
        }
        .difficulty-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--shadow-md);
        }
        .difficulty-card:hover:not(.disabled) {
          transform: translateY(-5px);
          border-color: var(--accent-primary);
          box-shadow: 0 10px 20px color-mix(in srgb, var(--accent-primary) 15%, transparent);
        }
        .difficulty-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sudoku-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          aspect-ratio: 1;
          background: var(--border-color);
          border: 3px solid var(--text-primary);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          max-width: 500px;
          margin: 0 auto;
        }
        .sudoku-cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 600;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          position: relative;
        }
        .sudoku-cell.clue {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
          font-weight: 700;
        }
        .sudoku-cell.user-entry {
          color: var(--accent-secondary);
        }
        .sudoku-cell.selected {
          background: color-mix(in srgb, var(--accent-primary) 15%, transparent) !important;
          box-shadow: inset 0 0 0 2px var(--accent-primary);
        }
        .sudoku-cell.highlighted {
          background: color-mix(in srgb, var(--accent-primary) 5%, transparent);
        }
        .sudoku-cell.same-number {
          background: color-mix(in srgb, var(--accent-secondary) 15%, transparent);
        }
        .sudoku-cell.conflict {
          color: var(--danger) !important;
          background: rgba(239, 68, 68, 0.1) !important;
        }
        /* Thick borders for 3x3 boxes */
        .sudoku-cell:nth-child(3n) {
          border-inline-end: 2px solid var(--text-primary);
        }
        .sudoku-cell:nth-child(9n) {
          border-inline-end: none;
        }
        .sudoku-cell:nth-child(x) {
          border-bottom: 2px solid var(--text-primary);
        }
        .sudoku-row-border {
          border-bottom: 2px solid var(--text-primary) !important;
        }
        .num-pad-btn {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          height: 48px;
          border-radius: 8px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .num-pad-btn:active, .num-pad-btn:hover {
          background: var(--accent-primary);
          color: var(--accent-contrast);
          transform: scale(0.95);
        }
        .leaderboard-tabs button {
          padding: 8px 16px;
          font-weight: 600;
          border-radius: 20px;
          transition: all 0.3s;
        }
        .leaderboard-tabs button.active {
          background: var(--accent-gradient);
          color: var(--accent-contrast);
          box-shadow: 0 4px 10px color-mix(in srgb, var(--accent-primary) 20%, transparent);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .completion-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 11, 17, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      {/* Completion Dialog */}
      {showCompletion && (
        <div className="completion-overlay">
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '450px', width: '90%', textAlign: 'center', borderRadius: '24px', border: '1px solid var(--accent-primary)' }}>
            <div style={{ background: 'var(--accent-gradient)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={40} color="var(--accent-contrast)" />
            </div>
            
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>
              {t('congratulations')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {t('completed')} {t(activeSession?.difficulty.toLowerCase())}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('time')}</span>
                <span style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--accent-secondary)' }}>{formatTime(elapsedSeconds)}</span>
              </div>
              {isNewPersonalBest && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--success)', fontWeight: '700', marginTop: '8px' }}>
                  <Award size={18} />
                  <span>{t('newPersonalBest')}</span>
                </div>
              )}
            </div>

            <button 
              onClick={handleCloseCompletion}
              className="btn-3d" 
              style={{ width: '100%', padding: '12px', background: 'var(--accent-gradient)', color: 'var(--accent-contrast)', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
            >
              {t('backToMenu')}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: Active Game Play View */}
      {inGame && puzzleData ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', lg: '3fr 2fr', gap: '32px', marginTop: '20px' }}>
          {/* Main Sudoku Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '500px', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', textTransform: 'capitalize', color: 'var(--accent-primary)' }}>
                  {t(activeSession?.difficulty.toLowerCase())}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div 
                  onDoubleClick={handleCheatSolve}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', cursor: window.location.hostname.includes('localhost') ? 'pointer' : 'default' }}
                  title={window.location.hostname.includes('localhost') ? 'Double-click to solve' : ''}
                >
                  <Clock size={16} color="var(--accent-secondary)" />
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1.1rem' }}>{formatTime(elapsedSeconds)}</span>
                </div>
                <button 
                  onClick={pauseGame}
                  className="navbar-btn"
                  style={{ background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={t('pauseGame')}
                >
                  <Pause size={16} />
                </button>
                <button 
                  onClick={discardGame}
                  className="navbar-btn"
                  style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={t('discardGame')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* The 9x9 Sudoku Grid */}
            <div className="sudoku-grid">
              {userState.map((val, idx) => {
                const row = Math.floor(idx / 9);
                const col = idx % 9;
                
                const isClue = puzzleData.puzzle[idx] !== '0';
                const isSelected = selectedCell === idx;
                
                // Row/Col/Box selection highlights
                const isHighlighted = selectedCell !== null && (
                  Math.floor(selectedCell / 9) === row ||
                  selectedCell % 9 === col ||
                  (Math.floor(Math.floor(selectedCell / 9) / 3) === Math.floor(row / 3) &&
                   Math.floor((selectedCell % 9) / 3) === Math.floor(col / 3))
                );

                // Same-number highlight
                const isSameNumber = val !== 0 && selectedCell !== null && userState[selectedCell] === val && selectedCell !== idx;
                
                // Conflict check
                const conflict = hasConflict(idx);

                // Row border styling for 3x3 grids
                const hasRowBorder = (row === 2 || row === 5);

                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedCell(idx)}
                    className={`sudoku-cell 
                      ${isClue ? 'clue' : 'user-entry'} 
                      ${isSelected ? 'selected' : ''} 
                      ${isHighlighted && !isSelected ? 'highlighted' : ''} 
                      ${isSameNumber ? 'same-number' : ''}
                      ${conflict ? 'conflict' : ''}
                      ${hasRowBorder ? 'sudoku-row-border' : ''}
                    `}
                  >
                    {val !== 0 ? val : ''}
                  </div>
                );
              })}
            </div>

            {/* Inputs / Numpad Controls */}
            <div style={{ width: '100%', maxWidth: '500px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '16px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => selectedCell !== null && handleCellInput(selectedCell, num)}
                  className="num-pad-btn"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => selectedCell !== null && handleCellInput(selectedCell, 0)}
                className="num-pad-btn"
                style={{ gridColumn: 'span 1', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                title={t('erase')}
              >
                <Delete size={20} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: Landing Dashboard View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--accent-gradient)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gamepad2 size={24} color="var(--accent-contrast)" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>{t('sudoku')}</h1>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                {isRTL ? 'تحدي ذكائك وحطم أرقاماً قياسية جديدة' : 'Challenge your mind and beat the fastest times'}
              </p>
            </div>
          </div>

          {/* Active Session Warning / resume card */}
          {activeSession && (
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--warning)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: 'rgba(245, 158, 11, 0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ color: 'var(--warning)' }}>
                  <Clock size={32} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontWeight: '700' }}>{t('youHavePausedGame')}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {t(activeSession.difficulty.toLowerCase())} • {t('elapsed')}: {formatTime(elapsedSeconds)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={resumeActiveGame}
                  className="btn-3d" 
                  style={{ padding: '8px 20px', background: 'var(--accent-gradient)', color: 'var(--accent-contrast)', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Play size={16} />
                  <span>{t('continueGame')}</span>
                </button>
                <button 
                  onClick={discardGame}
                  className="navbar-btn" 
                  style={{ border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={t('discardGame')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Start New Session Panel */}
          <div>
            <h3 style={{ fontWeight: '700', marginBottom: '16px' }}>
              {isRTL ? 'بدء جلسة لعب جديدة' : 'Start a New Session'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Easy difficulty card */}
              <div className={`difficulty-card ${activeSession ? 'disabled' : ''}`}>
                <div style={{ color: 'var(--success)', fontSize: '2.5rem', marginBottom: '8px' }}>🟢</div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>{t('easy')}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {isRTL ? 'مناسب للمبتدئين (38 رقماً معلوماً)' : 'Great for beginners (38 starting clues)'}
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('personalBest')}</span>
                  <span style={{ fontWeight: '700', color: 'var(--success)' }}>
                    {bestTimes['Easy'] ? formatTime(bestTimes['Easy']) : '--:--'}
                  </span>
                </div>
                <button
                  onClick={() => !activeSession && startNewGame('Easy')}
                  disabled={!!activeSession}
                  className="btn-3d"
                  style={{ width: '100%', padding: '10px', background: 'var(--success)', color: 'var(--on-status)', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  {t('startGame')}
                </button>
              </div>

              {/* Medium difficulty card */}
              <div className={`difficulty-card ${activeSession ? 'disabled' : ''}`}>
                <div style={{ color: 'var(--warning)', fontSize: '2.5rem', marginBottom: '8px' }}>🟡</div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>{t('medium')}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {isRTL ? 'تحدي متوازن (30 رقماً معلوماً)' : 'A balanced challenge (30 starting clues)'}
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('personalBest')}</span>
                  <span style={{ fontWeight: '700', color: 'var(--warning)' }}>
                    {bestTimes['Medium'] ? formatTime(bestTimes['Medium']) : '--:--'}
                  </span>
                </div>
                <button
                  onClick={() => !activeSession && startNewGame('Medium')}
                  disabled={!!activeSession}
                  className="btn-3d"
                  style={{ width: '100%', padding: '10px', background: 'var(--warning)', color: 'var(--on-status)', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  {t('startGame')}
                </button>
              </div>

              {/* Hard difficulty card */}
              <div className={`difficulty-card ${activeSession ? 'disabled' : ''}`}>
                <div style={{ color: 'var(--danger)', fontSize: '2.5rem', marginBottom: '8px' }}>🔴</div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '4px' }}>{t('hard')}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {isRTL ? 'للمحترفين فقط (24 رقماً معلوماً)' : 'For seasoned veterans (24 starting clues)'}
                </p>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('personalBest')}</span>
                  <span style={{ fontWeight: '700', color: 'var(--danger)' }}>
                    {bestTimes['Hard'] ? formatTime(bestTimes['Hard']) : '--:--'}
                  </span>
                </div>
                <button
                  onClick={() => !activeSession && startNewGame('Hard')}
                  disabled={!!activeSession}
                  className="btn-3d"
                  style={{ width: '100%', padding: '10px', background: 'var(--danger)', color: 'var(--on-status)', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  {t('startGame')}
                </button>
              </div>
            </div>
          </div>

          {/* Leaderboard Panel */}
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} color="var(--accent-secondary)" />
                <h3 style={{ margin: 0, fontWeight: '750' }}>{t('leaderboard')}</h3>
              </div>
              <div className="leaderboard-tabs" style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                {['Easy', 'Medium', 'Hard'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setLeaderboardTab(tab)}
                    style={{ 
                      border: 'none', 
                      background: leaderboardTab === tab ? 'var(--accent-gradient)' : 'transparent', 
                      color: leaderboardTab === tab ? '#ffffff' : 'var(--text-secondary)', 
                      padding: '6px 16px', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {t(tab.toLowerCase())}
                  </button>
                ))}
              </div>
            </div>

            {/* Ranked entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry) => (
                  <div 
                    key={entry.rank} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      background: 'rgba(255,255,255,0.01)', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-color)' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontWeight: '800', width: '24px', color: entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? '#cd7f32' : 'var(--text-secondary)' }}>
                        #{entry.rank}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--accent-contrast)', fontSize: '0.85rem' }}>
                          {entry.userName ? entry.userName[0].toUpperCase() : 'P'}
                        </div>
                        <span style={{ fontWeight: '600' }}>{entry.userName}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-secondary)' }}>
                        {formatTime(entry.timeSeconds)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  <HelpCircle size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>{t('noScoresYet')}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
      <AdInterstitial pageKey="sudoku" />
    </div>
  );
}

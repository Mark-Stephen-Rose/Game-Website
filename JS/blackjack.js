/* ============================================================
   BLACKJACK — Mark's Games
   Up to 3 players · Standard rules · Optional betting
   Hit, Stand, Double Down, Split
   6-deck shoe · Bot AI (basic strategy) · Multiplayer
   ============================================================ */

// ── Constants ──────────────────────────────────────────────

const SUITS           = ['♠','♥','♦','♣'];
const RANKS           = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS       = new Set(['♥','♦']);
const NUM_DECKS       = 6;
const STARTING_CHIPS  = 500;
const BET_OPTIONS     = [5, 10, 25, 50, 100];
const BOT_DELAY_MS    = 700;
const BOT_BET_AMOUNT  = 25;

// ── State ──────────────────────────────────────────────────

let state = {
  bettingOn:     false,
  numPlayers:    1,
  // 'vs-bots'     → player 0 is human, 1..n are AI
  // 'multiplayer' → all human, hot-seat
  mode:          'vs-bots',
  shoe:          [],
  dealer:        { cards: [] },
  players:       [],
  currentPlayer: 0,
  phase:         'idle',
  botThinking:   false,
};

// ── Deck ───────────────────────────────────────────────────

function buildShoe() {
  const deck = [];
  for (let d = 0; d < NUM_DECKS; d++)
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ rank, suit });
  return shuffle(deck);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCard() {
  if (state.shoe.length < 15) state.shoe = buildShoe();
  return state.shoe.pop();
}

// ── Hand Value ─────────────────────────────────────────────

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    if (c.rank === 'A') { aces++; total += 11; }
    else if (['J','Q','K'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBust(cards)      { return handValue(cards) > 21; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }
function isSoftHand(cards)  {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    if (c.rank === 'A') { aces++; total += 11; }
    else if (['J','Q','K'].includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  return aces > 0 && total <= 21;
}

function canSplit(hand) {
  return hand.cards.length === 2 &&
    cardNumValue(hand.cards[0]) === cardNumValue(hand.cards[1]);
}

function cardNumValue(card) {
  if (card.rank === 'A') return 11;
  if (['J','Q','K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

// ── Player Init ────────────────────────────────────────────

function initPlayers() {
  state.players = [];
  for (let i = 0; i < state.numPlayers; i++) {
    const isBot = state.mode === 'vs-bots' && i > 0;
    let name;
    if (state.numPlayers === 1) {
      name = 'Player';
    } else if (isBot) {
      name = `Bot ${i}`;
    } else if (state.mode === 'multiplayer') {
      name = `Player ${i + 1}`;
    } else {
      name = 'You';
    }
    state.players.push({
      name, isBot,
      chips:      STARTING_CHIPS,
      bet:        0,
      hands:      [],
      activeHand: 0,
      status:     'idle',
    });
  }
}

function freshHand(bet = 0) {
  return { cards: [], bet, done: false, doubled: false, result: null };
}

// ── Game Flow ──────────────────────────────────────────────

function startGame() {
  state.shoe = buildShoe();
  initPlayers();
  state.phase = 'idle';
  beginRound();
}

function beginRound() {
  state.dealer = { cards: [] };
  state.dealerUsedAllHits = false;
  state.players.forEach(p => {
    p.bet = 0;
    p.hands = [freshHand()];
    p.activeHand = 0;
    p.status = 'idle';
  });
  state.currentPlayer = 0;
  state.botThinking   = false;

  if (state.bettingOn) {
    state.phase = 'betting';
    // Bots auto-place bets immediately
    state.players.forEach((p, i) => { if (p.isBot) autoBotBet(i); });
  } else {
    dealInitial();
  }
  render();
}

// ── Betting ────────────────────────────────────────────────

function autoBotBet(idx) {
  const p = state.players[idx];
  const amt = Math.min(BOT_BET_AMOUNT, p.chips);
  if (amt > 0) { p.bet = amt; p.hands[0].bet = amt; }
}

function placeBet(playerIdx, amount) {
  const p = state.players[playerIdx];
  if (p.isBot || p.chips < amount || p.bet + amount > p.chips) return;
  p.bet += amount;
  p.hands[0].bet = p.bet;
  render();
}

function clearBet(playerIdx) {
  const p = state.players[playerIdx];
  if (p.isBot) return;
  p.bet = 0; p.hands[0].bet = 0;
  render();
}

function humanBetsPlaced() {
  return state.players.every(p => p.isBot || p.bet > 0);
}

function confirmBets() {
  if (state.bettingOn && !humanBetsPlaced()) return;
  dealInitial();
}

// ── Deal ───────────────────────────────────────────────────

function dealInitial() {
  state.phase = 'playing';
  state.players.forEach(p => p.hands[0].cards.push({ ...drawCard() }));
  state.dealer.cards.push({ ...drawCard() });
  state.players.forEach(p => p.hands[0].cards.push({ ...drawCard() }));
  state.dealer.cards.push({ ...drawCard(), hidden: true });
  state.currentPlayer = 0;
  advanceIfDone();
  render();
}

// ── Human Actions ──────────────────────────────────────────

function hit() {
  if (state.botThinking) return;
  const { p, hand } = currentHand();
  if (!p || p.isBot || hand.done) return;
  hand.cards.push({ ...drawCard() });
  if (isBust(hand.cards) || handValue(hand.cards) === 21) finishHand();
  else render();
}

function stand() {
  if (state.botThinking) return;
  const { p, hand } = currentHand();
  if (!p || p.isBot || !hand || hand.done) return;
  hand.done = true;
  advancePlayer();
}

function doubleDown() {
  if (state.botThinking) return;
  const { p, hand } = currentHand();
  if (!p || p.isBot || hand.done || hand.cards.length !== 2) return;
  if (state.bettingOn && p.chips < hand.bet) return;
  if (state.bettingOn) { p.chips -= hand.bet; hand.bet *= 2; }
  hand.doubled = true;
  hand.cards.push({ ...drawCard() });
  hand.done = true;
  advancePlayer();
}

function split() {
  if (state.botThinking) return;
  const { p, hand } = currentHand();
  if (!p || p.isBot || !canSplit(hand)) return;
  if (state.bettingOn && p.chips < hand.bet) return;
  const splitBet = hand.bet;
  if (state.bettingOn) p.chips -= splitBet;
  const newHand = freshHand(splitBet);
  newHand.cards.push(hand.cards.pop());
  hand.cards.push({ ...drawCard() });
  newHand.cards.push({ ...drawCard() });
  p.hands.splice(p.activeHand + 1, 0, newHand);
  render();
}

// ── Bot AI — Basic Strategy ────────────────────────────────

function botDecide(hand, dealerUpCard) {
  const val       = handValue(hand.cards);
  const soft      = isSoftHand(hand.cards);
  const canDbl    = hand.cards.length === 2;
  const canSplitN = canSplit(hand);
  const dv        = cardNumValue(dealerUpCard);

  if (canSplitN) {
    const pr = hand.cards[0].rank;
    if (pr === 'A' || pr === '8') return 'split';
    if (['10','J','Q','K'].includes(pr)) return 'stand';
    if (pr === '9' && dv !== 7 && dv !== 10 && dv !== 11) return 'split';
    if (pr === '7' && dv <= 7) return 'split';
    if (pr === '6' && dv <= 6) return 'split';
    if (pr === '4' && (dv === 5 || dv === 6)) return 'split';
    if ((pr === '2' || pr === '3') && dv <= 7) return 'split';
  }

  if (soft) {
    if (val >= 19) return 'stand';
    if (val === 18) {
      if (canDbl && dv >= 3 && dv <= 6) return 'double';
      if (dv >= 9) return 'hit';
      return 'stand';
    }
    if (val === 17 && canDbl && dv >= 3 && dv <= 6) return 'double';
    if ((val === 15 || val === 16) && canDbl && dv >= 4 && dv <= 6) return 'double';
    if ((val === 13 || val === 14) && canDbl && dv >= 5 && dv <= 6) return 'double';
    return 'hit';
  }

  if (val >= 17) return 'stand';
  if (val >= 13 && dv <= 6) return 'stand';
  if (val === 12 && dv >= 4 && dv <= 6) return 'stand';
  if (val === 11) return canDbl ? 'double' : 'hit';
  if (val === 10 && dv <= 9) return canDbl ? 'double' : 'hit';
  if (val === 9 && dv >= 3 && dv <= 6) return canDbl ? 'double' : 'hit';
  return 'hit';
}

function runBotTurn() {
  const { p, hand } = currentHand();
  if (!p || !p.isBot || hand.done) { advancePlayer(); return; }

  state.botThinking = true;
  render();

  setTimeout(() => {
    const { p: bp, hand: bh } = currentHand();
    if (!bp || !bp.isBot || bh.done) {
      state.botThinking = false;
      advancePlayer();
      return;
    }

    const dealerUp = state.dealer.cards.find(c => !c.hidden);
    const action   = botDecide(bh, dealerUp);
    const canDbl   = bh.cards.length === 2 && (!state.bettingOn || bp.chips >= bh.bet);
    const canSp    = canSplit(bh) && bp.hands.length < 3 && (!state.bettingOn || bp.chips >= bh.bet);

    if (action === 'split' && canSp) {
      if (state.bettingOn) bp.chips -= bh.bet;
      const nh = freshHand(bh.bet);
      nh.cards.push(bh.cards.pop());
      bh.cards.push({ ...drawCard() });
      nh.cards.push({ ...drawCard() });
      bp.hands.splice(bp.activeHand + 1, 0, nh);
      state.botThinking = false;
      render();
      setTimeout(runBotTurn, BOT_DELAY_MS);

    } else if (action === 'double' && canDbl) {
      if (state.bettingOn) { bp.chips -= bh.bet; bh.bet *= 2; }
      bh.doubled = true;
      bh.cards.push({ ...drawCard() });
      bh.done = true;
      state.botThinking = false;
      render();
      advancePlayer();

    } else if (action === 'hit') {
      bh.cards.push({ ...drawCard() });
      if (isBust(bh.cards) || handValue(bh.cards) === 21) {
        bh.done = true;
        state.botThinking = false;
        render();
        advancePlayer();
      } else {
        state.botThinking = false;
        render();
        setTimeout(runBotTurn, BOT_DELAY_MS);
      }

    } else {
      bh.done = true;
      state.botThinking = false;
      render();
      advancePlayer();
    }
  }, BOT_DELAY_MS);
}

// ── Turn Progression ───────────────────────────────────────

function finishHand() {
  const { hand } = currentHand();
  if (hand) hand.done = true;
  advancePlayer();
}

function advancePlayer() {
  const p = state.players[state.currentPlayer];
  if (!p) { dealerPlay(); return; }

  const nextHand = p.hands.findIndex((h, i) => i > p.activeHand && !h.done);
  if (nextHand !== -1) {
    p.activeHand = nextHand;
    render();
    if (p.isBot) setTimeout(runBotTurn, BOT_DELAY_MS);
    return;
  }

  state.currentPlayer++;
  advanceIfDone();
}

function advanceIfDone() {
  while (state.currentPlayer < state.players.length) {
    const p = state.players[state.currentPlayer];
    if (p.hands.every(h => h.done)) {
      state.currentPlayer++;
    } else {
      const hand = p.hands[p.activeHand];
      if (hand && !hand.done && handValue(hand.cards) === 21) {
        hand.done = true;
        advancePlayer();
        return;
      }
      if (p.isBot) {
        render();
        setTimeout(runBotTurn, BOT_DELAY_MS);
        return;
      }
      break;
    }
  }
  if (state.currentPlayer >= state.players.length) dealerPlay();
  else render();
}

function currentHand() {
  const p = state.players[state.currentPlayer];
  if (!p) return { p: null, hand: null };
  return { p, hand: p.hands[p.activeHand] };
}

// ── Dealer Play ────────────────────────────────────────────

function dealerPlay() {
  state.phase = 'dealer';
  state.dealer.cards.forEach(c => delete c.hidden);

  // Find the highest non-bust player hand value the dealer needs to beat
  let bestPlayerValue = 0;
  state.players.forEach(p => {
    p.hands.forEach(hand => {
      const hv = handValue(hand.cards);
      if (!isBust(hand.cards) && hv > bestPlayerValue) bestPlayerValue = hv;
    });
  });

  // Dealer hits to beat the best player hand, max 5 hits
  let hits = 0;
  const MAX_HITS = 5;

  while (hits < MAX_HITS) {
    const dv = handValue(state.dealer.cards);

    // If dealer busts, stop
    if (dv > 21) break;

    // If dealer already beats (or ties) the best player hand, stand
    if (dv >= bestPlayerValue) break;

    // Dealer must hit — still needs to beat someone
    state.dealer.cards.push({ ...drawCard() });
    hits++;
  }

  // 5-hit rule: if dealer used all 5 hits, all non-bust players win automatically
  state.dealerUsedAllHits = hits >= MAX_HITS;

  settle();
}

// ── Settlement ─────────────────────────────────────────────

function settle() {
  state.phase = 'done';
  const dv      = handValue(state.dealer.cards);
  const dbj     = isBlackjack(state.dealer.cards);
  const fiveHit = state.dealerUsedAllHits; // all non-bust players win
  const results = [];

  state.players.forEach(p => {
    p.hands.forEach(hand => {
      const hv   = handValue(hand.cards);
      const pbj  = isBlackjack(hand.cards);
      const bust = isBust(hand.cards);
      let result, payout = 0;

      if (bust) {
        // Busted players always lose, even on 5-hit rule
        result = 'bust';
      } else if (fiveHit) {
        // Dealer hit 5 times — all surviving players win outright
        result = 'win';
        payout = state.bettingOn ? hand.bet * 2 : 0;
      } else if (pbj && !dbj) {
        result = 'blackjack'; payout = state.bettingOn ? Math.floor(hand.bet * 2.5) : 0;
      } else if (pbj && dbj) {
        result = 'push';      payout = state.bettingOn ? hand.bet : 0;
      } else if (dbj) {
        result = 'lose';
      } else if (isBust(state.dealer.cards)) {
        result = 'win';  payout = state.bettingOn ? hand.bet * 2 : 0;
      } else if (hv > dv) {
        result = 'win';  payout = state.bettingOn ? hand.bet * 2 : 0;
      } else if (hv === dv) {
        result = 'push'; payout = state.bettingOn ? hand.bet : 0;
      } else {
        result = 'lose';
      }

      hand.result = result;
      if (state.bettingOn) p.chips += payout;
    });
    results.push({ name: p.name, isBot: p.isBot, hands: p.hands });
  });

  render();
  showResult(results);
}

// ── Result Banner ──────────────────────────────────────────

function showResult(results) {
  const banner  = document.getElementById('resultBanner');
  const text    = document.getElementById('resultText');
  const handsEl = document.getElementById('resultHands');

  const priority = { blackjack: 4, win: 3, push: 2, bust: 1, lose: 0 };
  let winnerHand = null, winnerLabel = '', best = -1;

  // Prefer featuring a human winner
  const preferred = results.filter(r => !r.isBot).length > 0
    ? results.filter(r => !r.isBot)
    : results;

  preferred.forEach(({ name, hands }) => {
    hands.forEach((hand, i) => {
      const score = priority[hand.result] ?? -1;
      if (score > best) {
        best = score; winnerHand = hand;
        const multi = results.length > 1 || hands.length > 1;
        winnerLabel = multi ? `${name}${hands.length > 1 ? ` (Hand ${i+1})` : ''}` : '';
      }
    });
  });

  handsEl.innerHTML = '';

  if (winnerHand && best >= 2) {
    const winSec = document.createElement('div');
    winSec.className = 'result-hand-section';
    if (winnerLabel) {
      const lbl = document.createElement('div');
      lbl.className = 'result-hand-label';
      lbl.textContent = winnerLabel;
      winSec.appendChild(lbl);
    }
    const winRow = document.createElement('div');
    winRow.className = 'card-row result-card-row';
    winnerHand.cards.forEach(c => winRow.appendChild(makeCardEl(c)));
    const winVal = document.createElement('div');
    winVal.className = 'result-hand-value';
    winVal.textContent = handValue(winnerHand.cards);
    winSec.appendChild(winRow);
    winSec.appendChild(winVal);
    handsEl.appendChild(winSec);

    const vs = document.createElement('div');
    vs.className = 'result-vs';
    vs.textContent = 'vs';
    handsEl.appendChild(vs);
  }

  const dealerSec = document.createElement('div');
  dealerSec.className = 'result-hand-section';
  const dlbl = document.createElement('div');
  dlbl.className = 'result-hand-label';
  dlbl.textContent = 'Dealer';
  dealerSec.appendChild(dlbl);
  const drow = document.createElement('div');
  drow.className = 'card-row result-card-row';
  state.dealer.cards.forEach(c => drow.appendChild(makeCardEl(c)));
  const dval = document.createElement('div');
  dval.className = 'result-hand-value';
  dval.textContent = handValue(state.dealer.cards);
  dealerSec.appendChild(drow);
  dealerSec.appendChild(dval);
  handsEl.appendChild(dealerSec);

  // Lines: humans first
  const sorted = [...results].sort((a, b) => (a.isBot ? 1 : 0) - (b.isBot ? 1 : 0));
  const lines = [];
  sorted.forEach(({ name, hands }) => {
    hands.forEach((hand, i) => {
      const label = results.length > 1 || hands.length > 1
        ? `${name}${hands.length > 1 ? ` (Hand ${i+1})` : ''}: ` : '';
      const msg = {
        blackjack: '🃏 Blackjack!',
        win: '✦ Win', push: '— Push', bust: '✕ Bust', lose: '✕ Lose',
      }[hand.result] || '';
      lines.push(label + msg);
    });
  });

  text.textContent = lines.join('\n');
  if (state.dealerUsedAllHits) {
    const rule = document.createElement('div');
    rule.className = 'five-hit-notice';
    rule.textContent = '5 hits — Dealer busts by rule';
    banner.querySelector('.result-inner').insertBefore(rule, text);
  }
  banner.classList.remove('hidden');
}

// ── Render ─────────────────────────────────────────────────

function render() {
  renderDealer();
  renderPlayers();
  renderActionBar();
}

function renderDealer() {
  const row   = document.getElementById('dealerCards');
  const score = document.getElementById('dealerScore');
  row.innerHTML = '';
  state.dealer.cards.forEach(c => row.appendChild(makeCardEl(c)));
  const visible = state.dealer.cards.filter(c => !c.hidden);
  score.textContent = visible.length > 0 ? handValue(visible) : '';
}

function renderPlayers() {
  const row = document.getElementById('playersRow');
  row.innerHTML = '';

  state.players.forEach((p, pi) => {
    const zone = document.createElement('div');
    zone.className = 'player-zone';
    if (p.isBot) zone.classList.add('bot-zone');

    const isActive = state.phase === 'playing' && pi === state.currentPlayer;
    if (isActive) zone.classList.add('active-turn');
    if (state.phase === 'playing' && pi !== state.currentPlayer) zone.classList.add('inactive');

    // Name row
    const nameRow = document.createElement('div');
    nameRow.className = 'player-name-row';
    let nameHTML = '';
    if (isActive) nameHTML += '<span class="turn-arrow">▶</span> ';
    nameHTML += p.name;
    if (p.isBot) nameHTML += ' <span class="bot-badge">BOT</span>';
    if (p.isBot && isActive && state.botThinking) nameHTML += ' <span class="bot-thinking">…</span>';
    nameRow.innerHTML = nameHTML;
    zone.appendChild(nameRow);

    // Hands
    if (p.hands.length > 1) {
      const sw = document.createElement('div');
      sw.className = 'split-hands';
      p.hands.forEach((hand, hi) => sw.appendChild(makeHandEl(hand, hi, p, pi, hi === p.activeHand && isActive)));
      zone.appendChild(sw);
    } else if (p.hands.length === 1) {
      zone.appendChild(makeHandEl(p.hands[0], 0, p, pi, isActive));
    }

    // Chips
    if (state.bettingOn) {
      const chips = document.createElement('div');
      chips.className = 'chip-display';
      chips.innerHTML = `Chips: <span>$${p.chips}</span>`;
      zone.appendChild(chips);
    }

    // Bet controls — human only, betting phase
    if (state.phase === 'betting' && !p.isBot) {
      const betRow = document.createElement('div');
      betRow.className = 'bet-controls';
      BET_OPTIONS.forEach(amt => {
        const btn = document.createElement('button');
        btn.className = 'chip-btn';
        btn.textContent = `+$${amt}`;
        btn.onclick = () => placeBet(pi, amt);
        betRow.appendChild(btn);
      });
      const betAmt = document.createElement('div');
      betAmt.className = 'bet-amount';
      betAmt.textContent = `Bet: $${p.bet}`;
      betRow.appendChild(betAmt);
      const clr = document.createElement('button');
      clr.className = 'chip-btn';
      clr.textContent = 'Clear';
      clr.onclick = () => clearBet(pi);
      betRow.appendChild(clr);
      zone.appendChild(betRow);
    }

    // Show current bet during play
    if (state.bettingOn && state.phase !== 'betting' && p.hands[0] && p.hands[0].bet > 0) {
      const betEl = document.createElement('div');
      betEl.className = 'chip-display';
      betEl.innerHTML = `Bet: <span>$${p.hands.reduce((s, h) => s + h.bet, 0)}</span>`;
      zone.appendChild(betEl);
    }

    row.appendChild(zone);
  });
}

function makeHandEl(hand, handIdx, player, playerIdx, isActiveHand) {
  const wrap = document.createElement('div');
  wrap.className = 'split-hand';
  const cardRow = document.createElement('div');
  cardRow.className = 'card-row';
  hand.cards.forEach(c => cardRow.appendChild(makeCardEl(c)));
  wrap.appendChild(cardRow);

  if (hand.cards.length > 0 && !hand.cards.some(c => c.hidden)) {
    const val = handValue(hand.cards);
    const scoreEl = document.createElement('div');
    scoreEl.className = 'zone-label';
    scoreEl.innerHTML = `<span class="score-badge">${val}</span>`;
    wrap.appendChild(scoreEl);
  }

  if (state.phase === 'done' && hand.result) {
    const badge = document.createElement('div');
    badge.className = `hand-status ${
      hand.result === 'blackjack' ? 'blackjack' :
      hand.result === 'bust' ? 'bust' :
      hand.result === 'win'  ? 'win'  : 'push'
    }`;
    badge.textContent = {
      blackjack: 'Blackjack', win: 'Win', push: 'Push', bust: 'Bust', lose: 'Lose',
    }[hand.result] || '';
    wrap.appendChild(badge);
  }
  return wrap;
}

function makeCardEl(card) {
  const el = document.createElement('div');
  el.className = `card${card.hidden ? ' face-down' : ''}${RED_SUITS.has(card.suit) ? ' red' : ''}`;
  if (!card.hidden) {
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-corner">
          <div class="card-rank">${card.rank}</div>
          <div class="card-suit">${card.suit}</div>
        </div>
        <div class="card-center">${card.suit}</div>
        <div class="card-corner bottom-right">
          <div class="card-rank">${card.rank}</div>
          <div class="card-suit">${card.suit}</div>
        </div>
      </div>`;
  }
  return el;
}

function renderActionBar() {
  const bar = document.getElementById('actionBar');
  bar.innerHTML = '';

  if (state.phase === 'idle') {
    const btn = document.createElement('button');
    btn.className = 'deal-btn';
    btn.textContent = 'Deal';
    btn.onclick = () => startGame();
    bar.appendChild(btn);
    return;
  }

  if (state.phase === 'betting') {
    if (state.numPlayers > 1) {
      const humanPending = state.players.filter(p => !p.isBot && p.bet === 0);
      if (humanPending.length > 0) {
        const lbl = document.createElement('div');
        lbl.className = 'player-turn-label';
        lbl.textContent = `${humanPending[0].name} — place your bet`;
        bar.appendChild(lbl);
      }
    }
    const btn = document.createElement('button');
    btn.className = 'action-btn primary';
    btn.textContent = humanBetsPlaced() ? 'Deal →' : 'Place bets to continue';
    btn.disabled = !humanBetsPlaced();
    btn.onclick = confirmBets;
    bar.appendChild(btn);
    return;
  }

  if (state.phase === 'playing') {
    const { p, hand } = currentHand();
    if (!p || !hand) return;

    if (p.isBot) {
      const lbl = document.createElement('div');
      lbl.className = 'bot-turn-label';
      lbl.textContent = `${p.name} is thinking…`;
      bar.appendChild(lbl);
      return;
    }

    if (state.numPlayers > 1) {
      const lbl = document.createElement('div');
      lbl.className = 'player-turn-label';
      lbl.textContent = `${p.name}'s turn`;
      bar.appendChild(lbl);
    }

    const canDbl  = hand.cards.length === 2 && (!state.bettingOn || p.chips >= hand.bet);
    const canSplH = canSplit(hand) && p.hands.length < 3 && (!state.bettingOn || p.chips >= hand.bet);

    [
      { label: 'Hit',    fn: hit,        always: true },
      { label: 'Stand',  fn: stand,      always: true },
      { label: 'Double', fn: doubleDown, cond: canDbl },
      { label: 'Split',  fn: split,      cond: canSplH },
    ].forEach(({ label, fn, always, cond }) => {
      if (!always && !cond) return;
      const btn = document.createElement('button');
      btn.className = 'action-btn' + (label === 'Hit' ? ' primary' : '');
      btn.textContent = label;
      btn.onclick = fn;
      bar.appendChild(btn);
    });
  }
}

// ── New Round ──────────────────────────────────────────────

document.getElementById('btnNewRound').addEventListener('click', function () {
  document.getElementById('resultBanner').classList.add('hidden');
  state.players.forEach(p => { if (p.chips <= 0) p.chips = STARTING_CHIPS; });
  beginRound();
});

// ── Setup Modal ────────────────────────────────────────────

(function initSetup() {
  let pendingPlayers = 1;
  let pendingBetting = false;
  let pendingMode    = 'vs-bots';

  function refreshModeVisibility() {
    const section = document.getElementById('setupModeSection');
    const hint    = document.getElementById('setupModeHint');
    section.classList.toggle('hidden', pendingPlayers === 1);
    if (hint) {
      hint.textContent = pendingMode === 'vs-bots'
        ? 'You play — other seats are AI opponents'
        : 'All players take turns on this device';
    }
  }

  document.querySelectorAll('#setupPlayers .setup-opt').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#setupPlayers .setup-opt').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      pendingPlayers = parseInt(this.dataset.val);
      refreshModeVisibility();
    });
  });

  document.querySelectorAll('#setupMode .setup-opt').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#setupMode .setup-opt').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      pendingMode = this.dataset.val;
      refreshModeVisibility();
    });
  });

  document.querySelectorAll('#setupBetting .setup-opt').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#setupBetting .setup-opt').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      pendingBetting = this.dataset.val === 'on';
    });
  });

  document.getElementById('btnSetupStart').addEventListener('click', function () {
    state.numPlayers = pendingPlayers;
    state.bettingOn  = pendingBetting;
    state.mode       = pendingPlayers === 1 ? 'vs-bots' : pendingMode;
    syncSettingsUI();
    document.getElementById('setupModal').classList.add('hidden');
    startGame();
  });
})();

// ── Inline Settings ────────────────────────────────────────

function syncSettingsUI() {
  document.querySelectorAll('#settingsPlayers .settings-opt').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val) === state.numPlayers);
  });
  document.querySelectorAll('#settingsBetting .settings-opt').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.val === 'on') === state.bettingOn);
  });
  document.querySelectorAll('#settingsMode .settings-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === state.mode);
  });
  const modeGroup   = document.getElementById('settingsModeGroup');
  const modeDivider = document.getElementById('settingsModeDivider');
  const show = state.numPlayers > 1;
  modeGroup.classList.toggle('hidden', !show);
  modeDivider.classList.toggle('hidden', !show);
}

function applySettingsChange(newPlayers, newBetting, newMode) {
  const effMode = newPlayers === 1 ? 'vs-bots' : newMode;
  if (newPlayers === state.numPlayers && newBetting === state.bettingOn && effMode === state.mode) return;

  state.numPlayers  = newPlayers;
  state.bettingOn   = newBetting;
  state.mode        = effMode;
  state.botThinking = false;

  document.getElementById('resultBanner').classList.add('hidden');
  state.shoe  = buildShoe();
  state.phase = 'idle';
  syncSettingsUI();
  initPlayers();
  beginRound();
}

document.querySelectorAll('#settingsPlayers .settings-opt').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('#settingsPlayers .settings-opt').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    applySettingsChange(parseInt(this.dataset.val), state.bettingOn, state.mode);
  });
});

document.querySelectorAll('#settingsBetting .settings-opt').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('#settingsBetting .settings-opt').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    applySettingsChange(state.numPlayers, this.dataset.val === 'on', state.mode);
  });
});

document.querySelectorAll('#settingsMode .settings-opt').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('#settingsMode .settings-opt').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    applySettingsChange(state.numPlayers, state.bettingOn, this.dataset.val);
  });
});

// ── Init ───────────────────────────────────────────────────

state.phase = 'idle';
initPlayers();
render();

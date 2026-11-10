// Jogo da velha do perfil: humano (❌) contra o bot (⭕) com minimax.
// Sem dependências e sem shell: tudo é texto, nenhuma entrada de usuário vira comando.

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const MOVE_RE = /^ttt\|move\|([1-9])$/;
const LOGIN_RE = /^[A-Za-z0-9-]{1,39}$/;

const emptyBoard = () => Array(9).fill('');

const newState = () => ({
  board: emptyBoard(),
  stats: { games: 0, botWins: 0, draws: 0, humanWins: 0 },
  moves: [],          // últimas jogadas humanas: { user, cell }
  lastResult: null,   // texto da última partida encerrada
});

function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? 'draw' : null;
}

// minimax com profundidade: o bot ganha o mais rápido possível e perde o mais tarde possível
function minimax(b, player, depth) {
  const w = winner(b);
  if (w === 'O') return { score: 10 - depth };
  if (w === 'X') return { score: depth - 10 };
  if (w === 'draw') return { score: 0 };
  let best = { score: player === 'O' ? -Infinity : Infinity, cell: -1 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const { score } = minimax(b, player === 'O' ? 'X' : 'O', depth + 1);
    b[i] = '';
    if (player === 'O' ? score > best.score : score < best.score) best = { score, cell: i };
  }
  return best;
}

function botMove(b) {
  // primeira resposta: centro se livre, senão um canto (mais rápido e igual ao minimax)
  if (b.filter(Boolean).length === 1) return b[4] ? 0 : 4;
  return minimax(b.slice(), 'O', 0).cell;
}

function finish(state, result, user) {
  state.stats.games++;
  if (result === 'O') { state.stats.botWins++; state.lastResult = `🤖 O bot venceu a partida contra @${user}.`; }
  else if (result === 'X') { state.stats.humanWins++; state.lastResult = `🏆 @${user} venceu o bot! Isso não deveria ser possível.`; }
  else { state.stats.draws++; state.lastResult = `🤝 Empate com @${user}. Ninguém passa do minimax.`; }
  state.board = emptyBoard();
}

/** Processa uma issue. Retorna { ok, state, reply }. Nunca lança erro por entrada ruim. */
function handle(title, user, state) {
  const m = MOVE_RE.exec(String(title || '').trim());
  if (!m) return { ok: false, state, reply: null }; // não é jogada: ignora a issue
  if (!LOGIN_RE.test(String(user || ''))) return { ok: false, state, reply: 'Usuário inválido.' };
  const cell = Number(m[1]) - 1;
  const b = state.board;
  if (b[cell]) {
    return { ok: false, state, reply: `A casa ${cell + 1} já está ocupada. Escolha outra casa livre no README. 🙂` };
  }
  b[cell] = 'X';
  state.moves.unshift({ user, cell: cell + 1 });
  state.moves = state.moves.slice(0, 5);

  let result = winner(b);
  let botCell = null;
  if (!result) {
    botCell = botMove(b);
    b[botCell] = 'O';
    result = winner(b);
  }
  let reply = `Você jogou na casa **${cell + 1}**` + (botCell !== null ? ` e o bot respondeu na casa **${botCell + 1}**.` : '.');
  if (result) {
    finish(state, result, user);
    reply += '\n\n' + state.lastResult + ' Um novo tabuleiro já está esperando no perfil.';
  } else {
    reply += ' Sua vez de novo no perfil!';
  }
  reply += '\n\n👉 https://github.com/vitorbordalo';
  return { ok: true, state, reply };
}

function render(state, repo) {
  const url = (i) => `https://github.com/${repo}/issues/new?title=ttt%7Cmove%7C${i + 1}&body=S%C3%B3+clique+em+%22Create%22.+O+bot+responde+em+uns+30+segundos.+%F0%9F%A4%96`;
  const cell = (i) => {
    const v = state.board[i];
    if (v === 'X') return '❌';
    if (v === 'O') return '⭕';
    return `<a href="${url(i)}" title="Jogar na casa ${i + 1}">⬜</a>`;
  };
  const rows = [0, 3, 6].map((r) =>
    '    <tr>' + [r, r + 1, r + 2].map((i) => `<td align="center" width="64" height="64"><h3>${cell(i)}</h3></td>`).join('') + '</tr>'
  ).join('\n');
  const s = state.stats;
  const moves = state.moves.length
    ? state.moves.map((m) => `<a href="https://github.com/${m.user}">@${m.user}</a> jogou na casa ${m.cell}`).join(' · ')
    : 'Ninguém jogou ainda. Seja a primeira pessoa!';
  return [
    '<!-- TTT:START -->',
    '<table align="center">',
    rows,
    '</table>',
    '',
    `<p align="center"><b>${s.games}</b> partidas · 🤖 <b>${s.botWins}</b> vitórias do bot · 🤝 <b>${s.draws}</b> empates · 🏆 <b>${s.humanWins}</b> vitórias humanas</p>`,
    state.lastResult ? `<p align="center"><sub>Última partida: ${state.lastResult}</sub></p>` : '',
    `<p align="center"><sub>Últimas jogadas: ${moves}</sub></p>`,
    '<!-- TTT:END -->',
  ].filter((l) => l !== '').join('\n');
}

function inject(readme, block) {
  return readme.replace(/<!-- TTT:START -->[\s\S]*?<!-- TTT:END -->/, block);
}

module.exports = { handle, render, inject, newState, winner, botMove };

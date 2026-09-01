export default function TicTacToe({ game, selfId, onMove, onReset }) {
  const mySymbol = game.players[0] === selfId ? "X" : game.players[1] === selfId ? "O" : null;
  const isMyTurn = mySymbol && mySymbol === game.turn && !game.winner;
  const waitingForPartner = game.players.length < 2;

  let status;
  if (waitingForPartner) status = "Waiting for your partner to join the room…";
  else if (game.winner === "draw") status = "It's a draw";
  else if (game.winner) status = game.winner === mySymbol ? "You won!" : "They won this one";
  else status = isMyTurn ? "Your move" : "Their move…";

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-center">
        <p className="font-display text-2xl mb-1">XOXO</p>
        <p className="text-sm text-muted">{status}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
        {game.board.map((cell, i) => (
          <button
            key={i}
            onClick={() => isMyTurn && !cell && onMove(i)}
            className={`aspect-square rounded-2xl border text-3xl font-display flex items-center justify-center transition-all ${
              cell
                ? "border-border bg-card"
                : "border-border bg-elevated hover:border-warm cursor-pointer"
            } ${!isMyTurn || game.winner ? "cursor-default" : ""}`}
          >
            <span className={cell === "X" ? "text-warm" : "text-cool"}>{cell}</span>
          </button>
        ))}
      </div>

      {mySymbol && (
        <p className="text-xs text-muted">
          You are playing as <span className={mySymbol === "X" ? "text-warm" : "text-cool"}>{mySymbol}</span>
        </p>
      )}

      {game.winner && (
        <button
          onClick={onReset}
          className="bg-warm text-ink text-sm font-semibold rounded-xl px-5 py-2 hover:brightness-110 transition"
        >
          Play again
        </button>
      )}
    </div>
  );
}

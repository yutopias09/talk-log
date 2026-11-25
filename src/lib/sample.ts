/** Builds a realistic-looking LINE export so people can try the app without a file. */
export function buildSampleChat(): string {
  let seed = 20240407;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const a = "みなみ";
  const b = "はると";
  const lines: string[] = ["[LINE] みなみとのトーク履歴", "保存日時：2026/11/20 21:14:02", ""];

  const weekday = ["日", "月", "火", "水", "木", "金", "土"];
  const conv = [
    ["おはよう！今日もいい天気だね☀️", "おはよう〜！ほんと気持ちいいね", "お昼どこ行く？", "駅前の新しいカフェ行ってみたい！", "いいね、12時半に現地集合？", "了解🫡"],
    ["今日ちょっと疲れた…", "おつかれさま😢 大丈夫？", "ありがとう、もうすぐ終わる！", "終わったら美味しいもの食べよ", "それ聞いて元気出た✨", "えへへ"],
    ["見て見て、この写真！", "[写真]", "かわいい！！どこで撮ったの？", "家の近くの公園🌸", "今度一緒に行こうよ", "ぜひ！お弁当持ってこ🍙"],
    ["明日の件、19時で大丈夫？", "OK！お店予約しておくね", "ありがとう、助かる〜", "楽しみにしてるね", "わたしも！", "じゃあ明日ね👋"],
    ["今日は何してたの？", "友達と映画見てた🎬", "いいな〜何見たの？", "ミステリー系！めっちゃ面白かった", "それ気になってたやつだ！", "今度一緒に見ようよ", "うん、絶対！"],
    ["眠い…仕事終わらない", "おつかれ🥲 あと少し！", "ありがとう。今週あと2日…", "週末はゆっくりしようね", "そうする〜", "おやすみ🌙"],
    ["ねえねえ、聞いて！", "どうしたの？", "昇進決まった！！", "えーーーおめでとう！！！🎉", "ありがとう！支えてくれて感謝です", "すごすぎる、お祝いしないと🍾", "ぜひ！"],
    ["今日のランチ、ラーメンだった🍜", "いいな〜私も食べたい", "今度の週末行こうか", "行く行く！", "楽しみ〜", "あ、でも宿題あるかも…", "じゃあ午後からね"],
    ["雨すごいね☔", "ほんと、傘忘れた…", "迎えに行こうか？", "いいの？嬉しい🥹", "当然でしょ", "ありがとう、大好き"],
    ["最近ちょっと寂しいな", "会いたいね", "うん、会いたい", "来週どこか行こう？", "水族館とかどう？", "いいね！決定🐬"],
    ["仕事つかれたー", "おつかれさま！今日はもう休んで", "ありがとう。明日頑張る", "応援してるよ📣", "ありがとう、心強い", "おやすみ😴"],
    ["テスト勉強終わらない😭", "何のテスト？", "数学…", "教えようか？", "ほんと！？お願いします🙏", "任せて！"],
    ["これ見て！ https://www.youtube.com/watch?v=talklog01", "めっちゃ笑った😂", "でしょ！", "今度ここ行かない？ https://tabelog.com/tokyo/A1301/A130101/13000001/", "おいしそう！行こう", "土曜でどう？"],
    ["このカフェよさそう https://www.instagram.com/p/talklog02/", "かわいい〜！", "週末行こ☕", "行く！楽しみ"],
  ];

  const start = new Date("2025-06-01T00:00:00");
  const end = new Date("2026-11-19T00:00:00");
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    if (rand() < 0.09) continue; // some silent days
    const dow = date.getDay();
    const base = dow === 0 || dow === 6 ? 16 : 11;
    const count = Math.max(2, Math.round(base + rand() * 12 - 4));
    const convo = conv[Math.floor(rand() * conv.length)];
    lines.push(
      `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate(),
      ).padStart(2, "0")}(${weekday[dow]})`,
    );
    let hour = 7 + Math.floor(rand() * 15);
    let minute = Math.floor(rand() * 50);
    let speaker = rand() > 0.5 ? a : b;
    for (let i = 0; i < count; i++) {
      const text = convo[i % convo.length];
      lines.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}\t${speaker}\t${text}`,
      );
      minute += 2 + Math.floor(rand() * 25);
      if (minute >= 60) {
        hour = Math.min(23, hour + Math.floor(minute / 60));
        minute %= 60;
      }
      if (rand() > 0.45) speaker = speaker === a ? b : a;
    }
    // 夜に通話することもある
    const callRoll = rand();
    if (callRoll < 0.14 && hour < 23) {
      const ch = Math.max(hour + 1, 21 + Math.floor(rand() * 2));
      const caller = rand() > 0.45 ? b : a;
      const stamp = `${String(Math.min(23, ch)).padStart(2, "0")}:${String(Math.floor(rand() * 59)).padStart(2, "0")}`;
      if (callRoll < 0.025) {
        lines.push(`${stamp}\t${caller}\t☎ 不在着信`);
      } else {
        const sec = Math.floor(120 + rand() * rand() * 7200);
        const hh = Math.floor(sec / 3600);
        const mm = Math.floor((sec % 3600) / 60);
        const ss = sec % 60;
        const dur = hh > 0 ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
        lines.push(`${stamp}\t${caller}\t☎ 通話時間 ${dur}`);
      }
    }
  }

  return lines.join("\n");
}

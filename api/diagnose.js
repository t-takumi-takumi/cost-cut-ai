const SYSTEM_PROMPT = `あなたは業務自動化の専門家です。ユーザーが選択した「具体的なツール名（Excel, Teamsなど）」の組み合わせを見て、それらを繋ぐ具体的な自動化シナリオを提案してください。
抽象的な話は避け、「Excelのマクロ」ではなく「n8nを使ったAPI連携」を推奨してください。
出力はJSON形式 { cost_reduction: 数値, report: Markdownテキスト } 厳守。`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { tools = [], employees, hourlyRate, manualHours, pain } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    return;
  }

  try {
    const userPrompt = `選択されたツール: ${tools.join(', ') || '未選択'}\n従業員数: ${employees}名\n平均時給: ${hourlyRate}円\n月間手作業時間(1人あたり): ${manualHours}時間\n悩み・課題: ${pain || '未記入'}\n\nJSON形式で、cost_reductionは年間で削減できる概算コスト(円)を数値で、reportはマークダウンで提案書を出力してください。`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(message || '{}');

    res.status(200).json({
      cost_reduction: parsed.cost_reduction ?? 0,
      report: parsed.report ?? '提案の生成に失敗しました。もう一度お試しください。'
    });
  } catch (error) {
    res.status(500).json({ error: error.message || '診断の生成に失敗しました' });
  }
};

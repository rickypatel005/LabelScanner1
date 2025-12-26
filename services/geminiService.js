import axios from 'axios';

export const analyzeImageWithGemini = async (base64Data, userProfile = { vegType: 'Vegetarian', goal: 'General Health' }) => {
  try {
    console.log('Sending image to Gemini Service...');
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: `Analyze this product's nutrition label and ingredients (from OCR or image)
and return ONLY a valid JSON object (no markdown, no extra text).

FOCUS AREAS:
1) Sugar (per serving)
2) Hidden sugars
3) Preservatives
4) Additives / colours / flavour enhancers
5) Overall vegetarian status and health impact

User profile:
- Vegetarian type: ${userProfile.vegType}
- Health goal: ${userProfile.goal}

When writing "healthInsight", adapt it to this goal.

Use this schema exactly:

{
  "productName": "short name of the product",
  "vegetarianStatus": "Vegetarian / Non-Vegetarian / Vegan / Unclear",
  "healthScore": "number (0-100), based on how well this product fits the user profile and goal. 100 is excellent, 0 is terrible.",
  "healthInsight": "one VERY short sentence (max 15 words) quick verdict.",
  "servingDescription": "serving size and unit if available, e.g. 30 g (1 pack)",
  "calories": "number (kcal per serving)",
  "protein": "number (g per serving)",
  "carbohydrates": "number (g per serving, total carbohydrates)",
  "totalFat": "number (g per serving)",
  "fiber": "number (g per serving)",
  "sugar": {
    "labelSugar": "number (g per serving)",
    "hiddenSugars": ["list of hidden sugar types found"]
  },
  "allergens": ["list of allergens detected, e.g. Milk, Nuts, Gluten"],
  "alternatives": ["3 specific healthier product alternatives better for their goal (e.g. Muscle Gain)"],
  "preservatives": [
    { "name": "e.g. Sodium benzoate", "concern": "short concern" }
  ],
  "additives": [
    { "name": "e.g. MSG", "concern": "short concern" }
  ]
}

Rules:
- Prefer PER SERVING values over per 100 g.
- If a field is unknown, use a sensible default: numbers as "0" and strings as "Unknown".
- **healthScore**: Be strict. High sugar/preservatives should lower the score significantly for weight loss/health goals.
- Output must be ONLY the JSON.
`,
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data,
                },
              },
            ],
          },
        ],
      },
      { params: { key: process.env.EXPO_PUBLIC_GEMINI_API_KEY } }
    );

    const responseText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini Response:', responseText);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw error;
  }
};

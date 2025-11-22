export const generateQuote = async (mood?: string): Promise<{ text: string; author: string }> => {
  try {
    const response = await fetch('/api/gemini/generate-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: mood || '' })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`Failed to generate quote: ${response.status}`);
    }

    const data = await response.json();

    // Check if the response contains an error (even with 200 status)
    if (data.error) {
      console.error('API returned error:', data.error, data.details);
      throw new Error(data.error);
    }

    return { text: data.text, author: data.author };
  } catch (error) {
    console.error('Error generating quote:', error);
    return { text: 'Every moment is a fresh beginning.', author: 'T.S. Eliot' };
  }
};

export interface PolishedContent {
  text: string;
  formatType: string;
  formatLabel: string;
}


export const polishContent = async (text: string): Promise<PolishedContent | null> => {
  try {
    const response = await fetch('/api/gemini/polish-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error('Failed to polish content');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error polishing content:', error);
    return null;
  }
};

// Note: generateThought is not used in the app, keeping stub for future use
export const generateThought = async (topic?: string): Promise<string> => {
  return "This feature is not currently implemented.";
};
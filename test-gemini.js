import { generateText, streamText } from 'ai';
import { google } from '@ai-sdk/google';

const messages = [
  { role: 'user', content: 'hello' },
  { role: 'assistant', content: 'hello back' },
  { role: 'user', content: 'test stream' }
];

async function run() {
  try {
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages,
      temperature: 0.7,
    });
    for await (const textPart of result.textStream) {
      process.stdout.write(textPart);
    }
  } catch(e) {
    console.error("SDK ERROR:", e);
  }
}
run();

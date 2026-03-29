import { config } from 'dotenv'; config({ path: '.env.local' });
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

async function run() {
  try {
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages: [
          { role: 'assistant', content: 'Welcome!' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello back' },
          { role: 'user', content: 'test stream' }
      ]
    });
    
    // Test what toTextStreamResponse actually outputs
    const response = result.toTextStreamResponse();
    console.log("RESPONSE STATUS:", response.status);
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while(true) {
        const {done, value} = await reader.read();
        if(done) break;
        console.log("STREAM CHUNK:", decoder.decode(value));
    }
  } catch(e) {
    console.log("SDK ERROR:", e);
  }
}
run();

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

exports.handler = async function(event) {
  const requestId = uuidv4();
  console.log(`[Request ${requestId}] Received request`, { method: event.httpMethod, path: event.path });

  if (event.httpMethod !== 'POST') {
    console.log(`[Request ${requestId}] Invalid HTTP method`, { method: event.httpMethod });
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error(`[Request ${requestId}] Missing OPENAI_API_KEY`);
      throw new Error('OPENAI_API_KEY is not set');
    }
    
    const API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com';
    const openaiApiUrl = `${API_BASE_URL}/v1/chat/completions`;
    
    // Parse the incoming request body
    const body = JSON.parse(event.body);
    console.log(`[Request ${requestId}] Request body`, { model: body.model, messagesLength: body.messages?.length });
    
    // Validate the request
    if (!body.model || !body.messages) {
      console.log(`[Request ${requestId}] Invalid request format`, { body });
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Invalid request format' })
      };
    }

    // Make request to OpenAI API
    console.log(`[Request ${requestId}] Making API request to OpenAI`);
    const response = await axios.post(openaiApiUrl, body, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: function(status) {
        return status >= 200 && status < 500; // handle all non-5xx errors
      }
    });

    if (response.status >= 400) {
      console.error(`[Request ${requestId}] OpenAI API error`, { status: response.status });
      throw new Error(response.data?.error?.message || 'OpenAI API error');
    }

    console.log(`[Request ${requestId}] Successfully received response`);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response.data)
    };

  } catch (error) {
    console.error(`[Request ${requestId}] Error processing request`, { error });
    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        error: error.response?.data?.error?.message || 
               error.message || 
               'Internal server error',
        requestId
      })
    };
  }
};

import { execute, parse, Source, buildSchema } from 'graphql';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 允许所有域名，生产环境可限制为特定域名
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 预检请求缓存时间（24小时）
};

// GraphQL Schema 定义
const schema = buildSchema(`
  type Query {
    askDeepSeek(prompt: String!): String!
  }
`);
// const DEEPSEEK_API_KEY = 'sk-0bb7310816e94ea9b5610697bd2b1460';
// Root resolver
const root = {
  askDeepSeek: async ({ prompt }) => {
    try {
      // DeepSeek API 请求
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`, // 替换为你的 DeepSeek API Key
        },
        body: JSON.stringify({
          "model": "deepseek-chat",
          "messages": [
            { "role": "user", "content": prompt }
          ],
          "temperature": 0.7,
          "max_tokens": 1000
        }),
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content.trim();
      }
      throw new Error('No valid response from DeepSeek');
    } catch (error) {
      throw new Error(`DeepSeek API error: ${error.message}`);
    }
  },
};

// Worker 处理逻辑
export default {
  async fetch(request) {
    try {

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // 仅处理 POST 请求
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }

      // 解析请求体中的 GraphQL 查询
      const body = await request.json();
      const query = body.query;
      const variables = body.variables || {};

      // 执行 GraphQL 查询
      const result = await execute({
        schema,
        document: parse(new Source(query)),
        rootValue: root,
        variableValues: variables,
      });

      // 返回 GraphQL 响应
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (error) {
      return new Response(JSON.stringify({ errors: [{ message: error.message }] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
// Cloudflare Pages Function - 千问API代理
export async function onRequest(context) {
  const { request, env } = context;
  
  // 设置CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 只允许POST请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { image, text } = body;

    if (!text && !image) {
      return new Response(JSON.stringify({ error: '缺少请求内容' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 构建消息内容
    const messageContent = [];
    
    // 如果有图片，先添加图片
    if (image) {
      messageContent.push({ image: image });
    }
    
    // 如果有文本，添加文本
    if (text) {
      messageContent.push({ text: text });
    } else if (image) {
      // 纯图片OCR，使用默认提示
      messageContent.push({ text: '请识别图片中的所有文字内容，直接输出识别到的文字，不要添加任何解释。' });
    }

    // 调用千问API
    const apiKey = env.QWEN_API_KEY || 'sk-d89e8cfb1eea4dfd90ddc3f5a8899910';
    
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-SSE': 'disable'
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        input: {
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('千问API错误:', errorText);
      return new Response(JSON.stringify({ 
        error: `千问API请求失败: ${response.status}`,
        details: errorText 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // 返回结果
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API错误:', error);
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

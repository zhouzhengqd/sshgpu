import https from 'https';
import { GPU } from '@shared/types';

export function sendDingtalkMessage(webhook: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(webhook);
    const body = JSON.stringify({
      msgtype: 'text',
      text: { content },
    });

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.errcode === 0) {
              resolve();
            } else {
              reject(new Error(result.errmsg || 'DingTalk API error'));
            }
          } catch {
            reject(new Error('Invalid response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function formatGpuIdleMessage(
  serverName: string,
  gpu: GPU,
  thresholdMinutes: number
): string {
  const memPercent =
    gpu.memoryTotal > 0
      ? Math.round((gpu.memoryUsed / gpu.memoryTotal) * 100)
      : 0;

  return [
    `[SSHGPU] GPU 空闲通知`,
    `服务器: ${serverName}`,
    `GPU ${gpu.index}: ${gpu.name}`,
    `利用率: ${gpu.utilization}%`,
    `显存: ${gpu.memoryUsed}/${gpu.memoryTotal} MB (${memPercent}%)`,
    `温度: ${gpu.temperature}°C`,
    `已空闲超过 ${thresholdMinutes} 分钟`,
  ].join('\n');
}

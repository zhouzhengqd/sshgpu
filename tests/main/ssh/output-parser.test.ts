import { describe, it, expect } from 'vitest';
import {
  parseNvidiaSmi,
  parseGpuProcesses,
  parseFreeMemory,
  parseTopCpu,
  parseDfDisk,
  parseSqueueTasks,
  parsePsAuxTasks,
  parseCondaEnvs,
  parseNetworkDev,
  parsePingLatency,
} from '../../../src/main/ssh/output-parser';

describe('parseNvidiaSmi', () => {
  it('should parse CSV nvidia-smi output with uuid', () => {
    const output = `0, NVIDIA A100 80GB, 1024, 81920, 45, 62, GPU-abc-123
1, NVIDIA A100 80GB, 512, 81920, 22, 58, GPU-def-456
2, NVIDIA A100 80GB, 75000, 81920, 89, 75, GPU-ghi-789
3, NVIDIA A100 80GB, 0, 81920, 0, 40, GPU-jkl-012`;
    const result = parseNvidiaSmi(output);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      index: 0,
      name: 'NVIDIA A100 80GB',
      memoryUsed: 1024,
      memoryTotal: 81920,
      utilization: 45,
      temperature: 62,
      uuid: 'GPU-abc-123',
      processes: [],
      idleSince: null,
    });
    expect(result[3].utilization).toBe(0);
    expect(result[3].uuid).toBe('GPU-jkl-012');
  });

  it('should handle empty output', () => {
    expect(parseNvidiaSmi('')).toEqual([]);
  });
});

describe('parseGpuProcesses', () => {
  it('should parse nvidia-smi compute apps output', () => {
    const output = `GPU-abc-123, 1234, python, 5120
GPU-abc-123, 5678, torch, 10240
GPU-def-456, 9012, train, 20480`;
    const result = parseGpuProcesses(output);
    expect(result.size).toBe(2);
    expect(result.get('GPU-abc-123')).toHaveLength(2);
    expect(result.get('GPU-abc-123')![0]).toEqual({ pid: 1234, name: 'python', memoryUsed: 5120 });
    expect(result.get('GPU-def-456')).toHaveLength(1);
    expect(result.get('GPU-def-456')![0]).toEqual({ pid: 9012, name: 'train', memoryUsed: 20480 });
  });

  it('should handle empty output', () => {
    const result = parseGpuProcesses('');
    expect(result.size).toBe(0);
  });
});

describe('parseFreeMemory', () => {
  it('should parse free -m output', () => {
    const output = `              total        used        free      shared  buff/cache   available
Mem:         128000       64000       32000        1024       32000       62000`;
    const result = parseFreeMemory(output);
    expect(result).toEqual({
      used: 64000,
      total: 128000,
      percent: 50,
    });
  });
});

describe('parseTopCpu', () => {
  it('should parse top header for CPU usage', () => {
    const output = `top - 14:30:00 up 10 days,  3:20,  2 users,  load average: 2.50, 1.80, 1.20
Tasks: 256 total,   2 running, 254 sleeping,   0 stopped,   0 zombie
%Cpu(s): 23.5 us,  5.2 sy,  0.0 ni, 70.1 id,  1.0 wa,  0.0 hi,  0.2 si,  0.0 st
MiB Mem : 128000.0 total,  32000.0 free,  64000.0 used,  32000.0 buff/cache
MiB Swap:   4096.0 total,   4096.0 free,      0.0 used.  62000.0 avail Mem`;
    const result = parseTopCpu(output);
    expect(result).toEqual({
      usage: 23.5,
      cores: 0,
    });
  });
});

describe('parseDfDisk', () => {
  it('should parse df -h output', () => {
    const output = `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1       500G  200G  300G  40% /`;
    const result = parseDfDisk(output);
    expect(result).toEqual({
      used: '200G',
      total: '500G',
      percent: 40,
    });
  });
});

describe('parseSqueueTasks', () => {
  it('should parse squeue output with STATE and REASON', () => {
    const output = `             JOBID PARTITION                       NAME     USER      TIME  NODES      STATE    REASON
            12345        gpu                train_bert    user1   2:30:15      2    RUNNING     None
            12346        gpu                  eval_gpt    user2       0:05      1    PENDING  Priority`;
    const result = parseSqueueTasks(output);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '12345',
      name: 'train_bert',
      user: 'user1',
      status: 'RUNNING',
      runtime: '2:30:15',
      resources: '2 nodes',
    });
    expect(result[1]).toEqual({
      id: '12346',
      name: 'eval_gpt',
      user: 'user2',
      status: 'PENDING',
      runtime: '0:05',
      resources: '1 nodes (Priority)',
    });
  });

  it('should handle empty squeue output (header only)', () => {
    const output = `             JOBID PARTITION                       NAME     USER      TIME  NODES      STATE    REASON`;
    const result = parseSqueueTasks(output);
    expect(result).toHaveLength(0);
  });
});

describe('parsePsAuxTasks', () => {
  it('should parse ps aux and return top memory consumers', () => {
    const output = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
user1     1234 50.0 10.0 100000 50000 pts/0    R+   10:00   5:00 python train.py
user1     1235  0.5  2.0  50000 10000 pts/1    S    10:01   0:10 vim`;
    const result = parsePsAuxTasks(output);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('python train.py');
    expect(result[0].user).toBe('user1');
  });
});

describe('parseCondaEnvs', () => {
  it('should parse conda env list output', () => {
    const output = `# conda environments:
#
base                     /home/user/miniconda3
py39                     /home/user/miniconda3/envs/py39
py310                    /home/user/miniconda3/envs/py310`;
    const result = parseCondaEnvs(output);
    expect(result).toEqual(['base', 'py39', 'py310']);
  });
});

describe('parseNetworkDev', () => {
  it('should parse /proc/net/dev for rx/tx bytes', () => {
    const output = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo frame compressed
    lo: 1000000    5000    0    0    0     0          0         0  1000000    5000    0    0    0     0       0
  eth0: 50000000  100000    0    0    0     0          0         0 20000000   50000    0    0    0     0       0`;
    const result = parseNetworkDev(output);
    expect(result.rx).toBeDefined();
    expect(result.tx).toBeDefined();
  });
});

describe('parsePingLatency', () => {
  it('should parse ping output for latency', () => {
    const output = `PING 10.0.0.1 (10.0.0.1): 56 data bytes
64 bytes from 10.0.0.1: icmp_seq=0 ttl=64 time=1.234 ms
64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=1.567 ms

--- 10.0.0.1 ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 1.234/1.400/1.567/0.166 ms`;
    const result = parsePingLatency(output);
    expect(result).toBeCloseTo(1.4, 1);
  });
});

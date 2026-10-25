import fs from 'node:fs';
import path from 'node:path';

export function createRunStore(directory) {
  fs.mkdirSync(directory, { recursive: true });

  const runDirectory = jobId => {
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) throw new Error('Invalid job ID.');
    return path.join(directory, jobId);
  };

  const writeJson = (filePath, value) => {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  };

  const read = jobId => {
    const filePath = path.join(runDirectory(jobId), 'run.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  };

  const write = run => writeJson(path.join(runDirectory(run.jobId), 'run.json'), run);

  return {
    start(jobId, metadata = {}) {
      const directoryPath = runDirectory(jobId);
      fs.mkdirSync(directoryPath, { recursive: true });
      const runPath = path.join(directoryPath, 'run.json');
      if (fs.existsSync(runPath)) throw new Error(`Run already exists: ${jobId}`);
      const now = new Date().toISOString();
      const run = {
        jobId,
        status: 'running',
        lastStep: 'upload',
        startedAt: now,
        updatedAt: now,
        metadata,
        checkpoints: {},
        events: []
      };
      write(run);
      return run;
    },

    append(jobId, event) {
      const run = read(jobId);
      if (!run) throw new Error(`Run not found: ${jobId}`);
      const step = event.step || run.lastStep;
      const message = String(event.message || event.error || '').slice(0, 2000);
      run.events.push({
        timestamp: new Date().toISOString(),
        type: event.type || 'log',
        step,
        ...(event.percent == null ? {} : { percent: event.percent }),
        message
      });
      run.lastStep = step;
      run.updatedAt = new Date().toISOString();
      if (event.type === 'error') run.status = 'failed';
      else if (event.type === 'complete') run.status = 'complete';
      else run.status = 'running';
      write(run);
      return run;
    },

    saveCheckpoint(jobId, name, value) {
      if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw new Error('Invalid checkpoint name.');
      const run = read(jobId);
      if (!run) throw new Error(`Run not found: ${jobId}`);
      const fileName = `${name}.json`;
      writeJson(path.join(runDirectory(jobId), fileName), value);
      run.checkpoints[name] = { file: fileName, savedAt: new Date().toISOString() };
      run.updatedAt = new Date().toISOString();
      write(run);
      return run.checkpoints[name];
    },

    loadCheckpoint(jobId, name) {
      if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw new Error('Invalid checkpoint name.');
      const run = read(jobId);
      if (!run?.checkpoints?.[name]) return null;
      return JSON.parse(fs.readFileSync(path.join(runDirectory(jobId), run.checkpoints[name].file), 'utf8'));
    },

    get: read,

    markInterrupted() {
      const activeRuns = this.list().filter(run => run.status === 'running');
      for (const run of activeRuns) {
        this.append(run.jobId, {
          type: 'error',
          step: run.lastStep,
          error: 'Server restarted while this run was active.'
        });
      }
      return activeRuns.length;
    },

    list() {
      return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && /^[a-zA-Z0-9_-]+$/.test(entry.name))
        .map(entry => read(entry.name))
        .filter(Boolean)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
  };
}

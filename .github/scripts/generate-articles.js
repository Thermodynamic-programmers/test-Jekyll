const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;

async function getFirstCommitDate(filePath) {
  try {
    const { data } = await octokit.repos.listCommits({
      owner, repo, path: filePath, per_page: 1, direction: 'asc'
    });
    return data[0]?.commit?.committer?.date || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function findMarkdownFiles(dir, base = dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '.github') continue;
      results.push(...findMarkdownFiles(full, base));
    } else if (entry.name.endsWith('.md') && !['README.md','CHANGELOG.md'].includes(entry.name)) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

(async () => {
  try {
    const files = findMarkdownFiles('.');
    const articles = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const slug = path.basename(file, '.md').toLowerCase().replace(/\s+/g, '-');
      const category = path.dirname(file) === '.' ? 'Без категории' : path.basename(path.dirname(file));
      const date = await getFirstCommitDate(file);

      // Извлечение заголовка
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(file, '.md');
      
      // Извлечение описания (первый абзац после заголовка)
      const contentWithoutTitle = content.replace(/^#.*$/m, '').trim();
      const descMatch = contentWithoutTitle.match(/^([^\n#].+?)(?:\n\n|$)/s);
      const description = descMatch 
        ? descMatch[1].trim().replace(/\n/g, ' ').substring(0, 150) + '…' 
        : '';

      articles.push({
        title, slug, description, category,
        content: content,
        date,
        path: file,
        tags: []
      });
    }

    // Сортировка: новые сверху
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2));
    console.log(`✓ Сгенерирован articles.json: ${articles.length} статей`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка генерации:', error.message);
    process.exit(1);
  }
})();

const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const { getReleaseChannelConfig, normalizeReleaseChannel } = require('../electron/release-channels.cjs');

// OSS 配置通过环境变量注入，禁止把 AccessKey 写入仓库。
const accessKeyId = process.env.OSS_ACCESS_KEY_ID
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET

if (!accessKeyId || !accessKeySecret) {
  throw new Error('缺少 OSS_ACCESS_KEY_ID 或 OSS_ACCESS_KEY_SECRET')
}

const client = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-shenzhen',
  accessKeyId,
  accessKeySecret,
  bucket: process.env.OSS_BUCKET || 'bikewise',
  timeout: 600000 // 10分钟超时
});

// 读取 package.json 获取版本号
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = packageJson.version;
const releaseChannel = getReleaseChannelConfig(
  normalizeReleaseChannel(process.env.RELEASE_CHANNEL || packageJson.releaseChannel)
);
const REMOTE_PREFIX = releaseChannel.feedPath;
const OUTPUT_DIR = releaseChannel.outputDir;
const PUBLIC_BASE_URL = releaseChannel.feedUrl;

console.log(`📦 当前版本: ${version}`);
console.log(`🚦 发布线: ${releaseChannel.id}`);
console.log('🚀 开始上传到阿里云 OSS...\n');

function buildUploadList() {
  const allowedNames = new Set(['latest.yml', 'latest-mac.yml'])
  const allowedExtensions = ['.exe', '.blockmap', '.dmg', '.zip', '.AppImage', '.deb', '.rpm']
  const entries = fs.existsSync(path.join(__dirname, '..', OUTPUT_DIR))
    ? fs.readdirSync(path.join(__dirname, '..', OUTPUT_DIR), { withFileTypes: true })
    : []

  return entries
    .filter((entry) => entry.isFile())
    .filter((entry) => {
      if (allowedNames.has(entry.name)) {
        return true
      }

      return allowedExtensions.includes(path.extname(entry.name))
    })
    .map((entry) => ({
      local: path.join(OUTPUT_DIR, entry.name),
      remote: `${REMOTE_PREFIX}/${entry.name}`,
      required: false,
    }))
}

const files = buildUploadList();

// 上传单个文件（带重试）
async function uploadFile(file, maxRetries = 3) {
  const localPath = path.join(__dirname, '..', file.local);
  
  // 检查文件是否存在
  if (!fs.existsSync(localPath)) {
    throw new Error(`文件不存在: ${file.local}`);
  }
  
  const fileStats = fs.statSync(localPath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`🔄 重试上传 (${attempt}/${maxRetries}): ${file.local}`);
      } else {
        console.log(`⬆️  上传中: ${file.local} (${fileSizeMB} MB)`);
      }
      
      let result;
      // 大文件（>10MB）使用分片上传
      if (fileStats.size > 10 * 1024 * 1024) {
        console.log(`   使用分片上传...`);
        result = await client.multipartUpload(file.remote, localPath, {
          progress: function(p) {
            const percent = (p * 100).toFixed(2);
            process.stdout.write(`\r   进度: ${percent}%`);
          },
          timeout: 600000, // 10分钟超时
          partSize: 1024 * 1024 * 2 // 2MB per part
        });
        console.log(); // 换行
      } else {
        // 小文件使用普通上传
        result = await client.put(file.remote, localPath);
      }
      
      if (result.res.status === 200) {
        console.log(`✅ 上传成功: ${result.url}\n`);
        return true;
      } else {
        throw new Error(`上传失败，状态码: ${result.res.status}`);
      }
    } catch (error) {
      console.error(`❌ 上传出错 (尝试 ${attempt}/${maxRetries}): ${file.local}`);
      console.error(`   错误信息: ${error.message}`);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 等待一段时间后重试
      const waitTime = attempt * 2000; // 递增等待时间
      console.log(`   等待 ${waitTime/1000} 秒后重试...\n`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// 上传文件
async function uploadFiles() {
  const failedFiles = [];
  const successFiles = [];
  const skippedFiles = [];
  
  for (const file of files) {
    const localPath = path.join(__dirname, '..', file.local);
    
    // 检查文件是否存在
    if (!fs.existsSync(localPath)) {
      if (file.required === false) {
        console.log(`⏭️  跳过不存在的文件: ${file.local}`);
        skippedFiles.push(file.local);
        continue;
      } else {
        console.error(`❌ 必需文件不存在: ${file.local}`);
        failedFiles.push(file.local);
        continue;
      }
    }
    
    try {
      await uploadFile(file);
      successFiles.push(file.local);
    } catch (error) {
      console.error(`\n❌ 文件上传最终失败: ${file.local}\n`);
      failedFiles.push(file.local);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 上传结果汇总:');
  console.log(`✅ 成功: ${successFiles.length} 个文件`);
  successFiles.forEach(f => console.log(`   - ${f}`));
  
  if (skippedFiles.length > 0) {
    console.log(`\n⏭️  跳过: ${skippedFiles.length} 个文件`);
    skippedFiles.forEach(f => console.log(`   - ${f}`));
  }
  
  if (failedFiles.length > 0) {
    console.log(`\n❌ 失败: ${failedFiles.length} 个文件`);
    failedFiles.forEach(f => console.log(`   - ${f}`));
    console.log('='.repeat(60));
    throw new Error('部分文件上传失败');
  }
  
  console.log('='.repeat(60));
  console.log('\n🎉 所有文件上传完成！');
  console.log(`\n📦 当前版本: ${version}`);
  console.log(`📝 更新服务器地址: ${PUBLIC_BASE_URL}/`);
  console.log(`📁 构建目录: ${OUTPUT_DIR}`);
  console.log(`📄 Windows 更新配置: ${PUBLIC_BASE_URL}/latest.yml`);
  console.log(`📄 Mac 更新配置: ${PUBLIC_BASE_URL}/latest-mac.yml`);
}

// 执行上传
uploadFiles().catch(error => {
  console.error('❌ 上传过程出现错误:', error);
  process.exit(1);
});

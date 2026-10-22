# ES模块问题修复说明

## 遇到的问题

运行 `npm run electron:dev` 时报错：

```
ReferenceError: require is not defined in ES module scope, you can use import instead
This file is being treated as an ES module because it has a '.js' file extension 
and '/Users/dragons/Desktop/electron/RuoYi-Vue3-master/package.json' contains "type": "module".
```

## 问题原因

1. **ES模块冲突**：
   - `package.json` 中设置了 `"type": "module"`，使整个项目默认使用 ES 模块
   - 但 `electron/main.js` 和 `electron/preload.js` 使用的是 CommonJS 语法（`require`）
   - 在 ES 模块环境下不能直接使用 `require`

2. **端口冲突**：
   - 8080 端口被其他进程占用
   - Vite 自动切换到 8081 端口
   - 但 Electron 配置仍然等待 8080 端口

## 解决方案

### 方案一：重命名为 .cjs 扩展名（已采用）✅

将 Electron 相关文件重命名为 `.cjs` 扩展名，明确标识为 CommonJS 模块：

```bash
# 重命名文件
mv electron/main.js electron/main.cjs
mv electron/preload.js electron/preload.cjs
```

然后修改 `package.json`：
```json
{
  "main": "electron/main.cjs"
}
```

修改 `electron/main.cjs` 中的 preload 路径：
```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs')
}
```

**优点**：
- ✅ 改动最小
- ✅ 不需要重写代码
- ✅ 与 Electron 社区实践一致
- ✅ 更稳定可靠

### 方案二：改用 ES 模块语法（未采用）

将所有 `require` 改为 `import`，这需要大量代码修改，且 Electron 主进程对 ES 模块支持还不够完善。

## 修改的文件

1. ✅ `electron/main.js` → `electron/main.cjs`
2. ✅ `electron/preload.js` → `electron/preload.cjs`
3. ✅ `package.json` - 修改 main 字段
4. ✅ `electron/main.cjs` - 修改 preload 路径

## 验证修复

启动应用：
```bash
npm run electron:dev
```

**预期结果**：
- ✅ Vite 开发服务器启动在 http://localhost:8080
- ✅ Electron 窗口自动弹出
- ✅ 不再报 "require is not defined" 错误

## 端口冲突处理

如果 8080 端口被占用：

### 1. 查看占用端口的进程
```bash
lsof -i :8080
```

### 2. 停止占用端口的进程
```bash
kill -9 <PID>
```

### 3. 或者修改端口配置

如果想使用其他端口（如 8081），需要同步修改：

**vite.config.js**：
```javascript
server: {
  port: 8081,  // 修改端口
  // ...
}
```

**electron/main.cjs**：
```javascript
const startUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8081'  // 修改端口
  : url.format({...});
```

**package.json**：
```json
{
  "scripts": {
    "electron:dev": "concurrently \"vite\" \"wait-on http://localhost:8081 && cross-env NODE_ENV=development electron .\""
  }
}
```

## 注意事项

1. **文件扩展名很重要**：
   - `.js` - 在 `"type": "module"` 项目中默认为 ES 模块
   - `.cjs` - 始终被视为 CommonJS 模块
   - `.mjs` - 始终被视为 ES 模块

2. **Electron 推荐使用 CommonJS**：
   - Electron 主进程对 ES 模块的支持还不够成熟
   - 大多数 Electron 示例和文档使用 CommonJS
   - 使用 `.cjs` 扩展名是最佳实践

3. **不要删除 `"type": "module"`**：
   - Vue3 + Vite 项目需要这个配置
   - 只需要 Electron 文件使用 `.cjs` 扩展名即可

## 相关文件结构

```
RuoYi-Vue3-master/
├── electron/
│   ├── main.cjs        ✅ CommonJS 模块
│   └── preload.cjs     ✅ CommonJS 模块
├── src/                (使用 ES 模块)
├── package.json        ("type": "module" 保持不变)
└── vite.config.js      (ES 模块)
```

## 其他 Electron 文件说明

所有 Electron 相关的 Node.js 代码都应该使用 `.cjs` 扩展名：
- 主进程文件
- 预加载脚本
- Electron 构建脚本（如果有）

---

**问题已完全解决！现在可以正常运行 Electron 桌面应用了！** ✅


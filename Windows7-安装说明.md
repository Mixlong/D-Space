# DigiSmart Windows 7 安装说明

## 遇到内存错误？

如果安装时出现 `0x71be1581 指令引用的 0x02945000 内存。该内存不能为 read` 错误：

### 解决方案 1：安装必需的运行库（推荐）

**下载并安装 Visual C++ 运行库：**

1. **Visual C++ 2015-2022 Redistributable (x64)**
   - 下载地址：https://aka.ms/vs/17/release/vc_redist.x64.exe
   - 或访问：https://learn.microsoft.com/zh-cn/cpp/windows/latest-supported-vc-redist

2. **安装步骤：**
   - 下载 `vc_redist.x64.exe`
   - 右键选择"以管理员身份运行"
   - 完成安装后重启电脑
   - 重新运行 DigiSmart 安装程序

### 解决方案 2：使用便携版（无需安装）

如果安装版仍然出错，请使用便携版：

1. 解压 `DigiSmart-1.0.9-Portable.exe` 到任意文件夹
2. 右键 `DigiSmart.exe` → "以管理员身份运行"
3. 如果提示缺少 DLL，安装上述 Visual C++ 运行库

### 解决方案 3：系统更新

确保 Windows 7 已安装所有更新：

1. 开始菜单 → Windows Update
2. 检查更新并安装所有可用更新
3. 特别确保安装了 **Windows 7 Service Pack 1 (SP1)**

### 解决方案 4：内存诊断

如果以上方法都无效，可能是系统问题：

1. **运行内存诊断：**
   - 开始菜单 → 搜索"内存诊断"
   - 选择"立即重新启动并检查问题"

2. **检查磁盘错误：**
   ```cmd
   chkdsk C: /f /r
   ```

3. **系统文件检查：**
   ```cmd
   sfc /scannow
   ```

### 解决方案 5：兼容性模式

1. 右键点击安装程序
2. 属性 → 兼容性
3. 勾选"以兼容模式运行这个程序"
4. 选择"Windows 7"
5. 勾选"以管理员身份运行此程序"
6. 应用 → 确定

---

## 系统要求

- **操作系统**: Windows 7 SP1 及以上
- **处理器**: 双核 1.8 GHz 或更高
- **内存**: 4 GB RAM 或更多
- **硬盘空间**: 500 MB 可用空间
- **必需组件**: 
  - Visual C++ 2015-2022 Redistributable (x64)
  - .NET Framework 4.5 或更高

---

## 常见问题

### Q1: 为什么 Windows 7 需要额外的运行库？
A: Electron 应用基于 Chromium，需要现代的 C++ 运行库支持。Windows 7 默认不包含这些新版本的运行库。

### Q2: 安装后无法启动怎么办？
A: 
1. 检查是否安装了 Visual C++ 运行库
2. 尝试以管理员身份运行
3. 查看事件查看器中的错误日志

### Q3: 建议升级到 Windows 10/11 吗？
A: 是的。Windows 7 已于 2020年1月停止支持，建议升级到 Windows 10 或 Windows 11 以获得更好的性能和安全性。

---

## 技术支持

如果以上方法都无法解决问题，请联系技术支持并提供：
1. Windows 版本信息（运行 `winver` 命令查看）
2. 错误截图
3. 事件查看器中的错误日志

---

**注意**: Windows 7 支持将在后续版本中逐步移除，建议尽快升级操作系统。

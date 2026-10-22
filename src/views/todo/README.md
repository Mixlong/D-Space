# 待办事项模块

## 📁 目录结构

```
todo/
├── MyTodo/                    # 我的待办
│   ├── components/            # 子组件文件夹
│   │   ├── TodoCard.vue       # 待办卡片组件
│   │   └── CompleteDialog.vue # 完成确认对话框组件
│   └── index.vue              # 主入口组件
│
└── MyAssign/                  # 我的交办
    ├── components/            # 子组件文件夹
    │   ├── TodoCard.vue       # 待办卡片组件
    │   └── CompleteDialog.vue # 完成确认对话框组件
    └── index.vue              # 主入口组件
```

## 📝 说明

- **主组件 (index.vue)**: 负责数据管理、业务逻辑和子组件协调
- **子组件 (components/)**: 包含所有可复用的 UI 组件

## 🔗 相关路由

- `/my-todo` - 我的待办页面
- `/my-assign` - 我的交办页面

## 📚 详细文档

请参阅项目根目录的 `待办组件结构说明.md` 获取完整的组件文档。

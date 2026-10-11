# 小组协作指南

## 开始一个任务

首次获取仓库：

```bash
git clone git@github.com:DuscWalk/HCI-What-to-Eat.git
cd HCI-What-to-Eat
git switch develop
```

每个任务从最新的 `develop` 创建分支：

```bash
git switch develop
git pull --ff-only
git switch -c docs/your-name-interview
```

文档使用 `docs/` 前缀，功能使用 `feature/`，修复使用 `fix/`。分支名使用英文、数字和连字符；一个分支尽量对应一个明确任务。

## 提交与合并

1. 检查改动范围，使用具体文件路径暂存，避免把临时文件一并加入。
2. 运行 `python scripts/check_local_references.py`，再查看 `git diff --cached`。
3. 提交并推送任务分支，在 GitHub 创建目标为 `develop` 的 PR。
4. 由另一位组员检查内容与研究口径后合并；完成后删除任务分支。
5. 阶段成果统一通过 `develop` 到 `main` 的 PR 发布。

```bash
git add docs/正式材料/访谈提纲.md
git commit -m "docs: 完善访谈追问"
git push -u origin docs/your-name-interview
```

`main` 和 `develop` 不直接堆放个人试验改动，不强制推送共享分支。发生冲突时核对双方内容，不直接用一方整份覆盖另一方。

仓库管理员还应在 GitHub 的 Settings → Rules → Rulesets 中保护 `main` 和 `develop`：要求通过 PR 合并、至少一位其他组员审阅、通过 `Check local references` 检查，并禁止强制推送和删除分支。仓库中的约定不能代替服务器端规则。

## 文档约定

- 优先在 Markdown 中协作，文件使用 UTF-8 编码。
- 在 PR 中说明改了什么、依据是什么，以及是否影响研究范围、访谈口径或问卷分支。
- 访谈执行稿与扩展方案分别维护；正式发放前固定版本。
- 文献总结以 Markdown 为编辑依据，交付前同步 Word 版本。
- 保留 DOI、公开链接、阅读范围与证据局限，不在共享文档中依赖个人电脑的文件位置。

## 本地与研究资料

`.local/`、`private/`、`data/raw/` 和本机环境配置已加入忽略规则。个人文献库、原始访谈数据与参与者联系方式不提交；共享分析只使用经过核对的去标识化材料。

忽略规则只能排除文件，不能清理文档内部的路径。自动检查负责发现常见本机路径与内部文献链接，提交者仍需人工检查内容。

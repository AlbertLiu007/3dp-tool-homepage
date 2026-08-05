# 礼品站员工审核与 AI 额度配置

## 生产环境变量

礼品站运行时与数据库迁移共用以下数据库配置：

```dotenv
GIFT_DB_HOST=rm-example.mysql.rds.aliyuncs.com
GIFT_DB_PORT=3306
GIFT_DB_USER=unionam_gift_app
GIFT_DB_NAME=unionam_gift
GIFT_DB_PASSWORD_FILE=/srv/unionam/shared/secrets/gift-db-password
GIFT_DB_SSL=false
```

如果后续开启 RDS SSL，再增加：

```dotenv
GIFT_DB_SSL=true
GIFT_DB_SSL_CA_FILE=/srv/unionam/shared/certs/rds-ca.pem
```

Ops 后台和首位管理员配置：

```dotenv
GIFT_OPS_ORIGIN=https://ops.unionam.com
GIFT_COOKIE_DOMAIN=.unionam.com
GIFT_OPS_ADMIN_USER_IDS=企业微信UserId1,企业微信UserId2
```

`GIFT_OPS_ADMIN_USER_IDS` 必须填写企业微信返回的 UserId，不是员工姓名。名单中的员工下次扫码登录时会自动设置为 `admin` 并批准 AI 权限。其他员工首次扫码后默认为 `pending`。

OSS 使用 ECS RAM 角色临时凭证，不配置长期 AccessKey：

```dotenv
GIFT_OSS_BUCKET=unionam-model-library-prod-liantaigift-20260805
GIFT_OSS_REGION=oss-cn-shanghai
GIFT_OSS_ECS_ROLE=UnionAMLiantaiGiftEcsRole
GIFT_OSS_INTERNAL=true
```

上传接口最大允许 50MB，Nginx 对 `ops.unionam.com` 还需要配置不低于 `client_max_body_size 50m`。

## 数据库升级

发布新版本后、切换应用流量前执行：

```bash
npm run migrate:gift-db -w apps/homepage
```

迁移脚本使用数据库锁和校验和，只执行尚未应用的版本。不要修改已经在生产执行过的 migration 文件。

## 域名与代理

`ops.unionam.com` 的 DNS 应解析到礼品站所在服务器，Nginx 将该域名代理到与 `unionam.com` 相同的 Next.js 服务。应用会把 Ops 域名根路径内部重写到 `/ops`。

企业微信授权回调继续使用：

```text
https://unionam.com/api/gift/auth/wecom/callback
```

Ops 登录入口会先跳转到 `unionam.com` 发起企微授权，回调成功后再返回 `ops.unionam.com`。因此生产环境必须配置 `GIFT_COOKIE_DOMAIN=.unionam.com`。

## 默认权限与额度

- 首次扫码员工：`pending`，可以浏览礼品库，不能调用 AI。
- 审核批准员工：`approved`，默认图片生成 10 次/日、图片编辑 10 次/日、3D 模型生成 3 次/日。
- 默认同时只允许 1 个 AI 任务。
- Ops 可为每位员工单独调整额度。
- 只有 `admin` 可以授予或取消 `operator/admin` 角色。
- 环境变量中的首位管理员不能在后台被降级；修改管理员根名单需要调整环境变量并重启服务。
- 同步生成失败会自动返还额度；3D 任务明确返回失败时会返还额度。
- 所有高成本接口均在服务端重新查询审批状态和额度，前端展示状态不作为授权依据。

## 首次启用顺序

1. 配置数据库和 Ops 环境变量。
2. 执行数据库 migration。
3. 发布并重启 Next.js 服务。
4. 配置 `ops.unionam.com` DNS、HTTPS 证书和 Nginx 代理。
5. `GIFT_OPS_ADMIN_USER_IDS` 中的管理员重新扫码登录一次。
6. 打开 `https://ops.unionam.com` 审批员工、设置额度并按需授予其他管理员。
7. 在模型库创建记录，上传模型与缩略图，确认 OSS RAM 角色权限正常。

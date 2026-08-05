# 礼品站 AI 服务配置说明

## 服务关系

- `wan2.7-image-pro`：根据文字与客户画像生成礼品工艺渲染图，也用于继续编辑已生成图片。
- 腾讯混元生 3D 3.1：将员工上传图片或选中的渲染图生成不带纹理的白膜 STL。
- 浏览器只调用 UnionAM 自己的 `/api/gift/ai/*` 接口，第三方 Key 不会下发到前端。

## 本地配置

在 `apps/homepage/.env.local` 中配置：

```text
HUNYUAN_3D_BASE_URL=https://tokenhub.tencentmaas.com/v1/api/3d
HUNYUAN_3D_API_KEY=
HUNYUAN_3D_MODEL=hy-3d-3.1
HUNYUAN_3D_RESULT_FORMAT=STL
HUNYUAN_3D_FACE_COUNT=300000

GPT_IMAGE_BASE_URL=https://api.cdn-krill-ai.com/v1
GPT_IMAGE_API_KEY=
GPT_IMAGE_MODEL=wan2.7-image-pro
GPT_IMAGE_SIZE=1024x1024
GPT_IMAGE_QUALITY=high
```

环境变量不得使用 `NEXT_PUBLIC_` 前缀，不得提交到 Git。

## 生产配置

生产环境建议将同样的变量写入：

```text
/srv/unionam/homepage/apps/homepage/.env.production.local
```

文件权限设置为仅部署用户可读，并在修改后重新构建、重启 PM2 服务。

## 当前接口

- `POST /api/gift/ai/render`：生成 3 张礼品渲染图。
- `POST /api/gift/ai/edit`：基于选中图片和文字继续编辑，可选同尺寸 PNG 透明蒙版。
- `POST /api/gift/ai/3d/submit`：提交混元白膜模型任务。
- `GET /api/gift/ai/3d/query?id=...`：查询混元任务并返回 STL 下载地址。

所有接口都要求有效的联泰员工礼品站会话。

## 固定白膜参数

混元请求由服务端固定添加：

```json
{
  "generate_type": "Geometry",
  "enable_pbr": false,
  "result_format": "STL"
}
```

单色喷漆和铜做旧只存在于渲染图及打印申请的后处理要求中，不写入 3D 模型纹理。

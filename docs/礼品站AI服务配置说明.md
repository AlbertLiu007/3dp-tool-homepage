# 礼品站 AI 服务配置说明

## 服务关系

- `wan2.7-image-pro`：根据文字与客户画像生成礼品工艺渲染图，也用于继续编辑已生成图片。
- Tripo H3.1：将员工上传图片或选中的渲染图生成不带纹理的 GLB 几何模型；UnionAM 服务器负责转换为用于打印的 STL。
- 浏览器只调用 UnionAM 自己的 `/api/gift/ai/*` 接口，第三方 Key 不会下发到前端。

## 本地配置

在 `apps/homepage/.env.local` 中配置：

```text
TRIPO_3D_BASE_URL=https://openapi.tripo3d.com/v3
TRIPO_3D_API_KEY=
TRIPO_3D_MODEL=v3.1-20260211
TRIPO_3D_FACE_LIMIT=1500000
TRIPO_3D_GEOMETRY_QUALITY=standard
GIFT_3D_DEFAULT_LONGEST_MM=100

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
- `POST /api/gift/ai/3d/submit`：上传单张白底图并提交 Tripo 图片生成模型任务。
- `GET /api/gift/ai/3d/query?id=...`：查询 Tripo 生成任务，并在成功后触发服务器 GLB → STL 转换。
- `GET /api/gift/ai/3d/file?id=...&type=stl`：下载服务器生成并缓存的二进制 STL 文件。

所有接口都要求有效的联泰员工礼品站会话。

## 固定白膜与打印参数

Tripo 图片生成请求由服务端固定添加：

```json
{
  "texture": false,
  "pbr": false,
  "export_uv": false,
  "face_limit": 1500000,
  "geometry_quality": "standard"
}
```

模型生成成功后，服务端直接下载 Tripo 返回的 GLB，不再调用收费的 `convert_model`。服务器执行以下处理：

- 将 glTF 的 Y 轴朝上转换为切片软件使用的 Z 轴朝上。
- 将模型最长边缩放到 `GIFT_3D_DEFAULT_LONGEST_MM`（默认 100mm）。
- 将模型在 X/Y 方向居中，并让最低点落在 Z=0 打印平台。
- 输出无纹理的二进制 STL，并按生成任务缓存，避免重复转换。

服务端固定使用 v3.1、Standard、150 万面、无纹理参数，并检查任务返回的 `credits_consumed`。任何环境配置偏离该组合都会拒绝提交，正常单次 Tripo 图片生成任务最多消耗 20 积分。

单色喷漆和铜做旧只存在于渲染图及打印申请的后处理要求中，不写入 3D 模型纹理。

# 文件上传
目前支持pdf,doc,docx,xls,xlsx,ppt,pptx,md,txt上传，上传到MinIO

# 上传流程
    1、前端拖动或选择上传文件到本地列表，点击上传按钮；一次性选多个文件，循环串行 / 并行上传，批量入库
    2、前端携带知识库ID(kbId)请求后端GET /upload/get-minio-sts 获取临时 STS 凭证
    3、后端收到 /upload/get-minio-sts 请求，做两件事：JWT 登录鉴权、校验当前用户对该 kbId 是否拥有admin/editor上传权限（viewer 直接拒绝）
    4、权限通过，后端调用 MinIO AssumeRole 接口生成临时 STS AccessKey/SecretKey/SessionToken + 过期时间 + 上传 Policy返回前端
    5、前端用 minio-js + STS 临时凭证直传文件到 MinIO 指定桶 + 指定前缀路径；
      Axios 封装切片上传 / 普通上传，分片上传：超过 20MB 自动切分 5MB 一片，OSS 分片上传，支持断点续传、暂停、重试；
      文件类型白名单校验、大小校验、进度条
    6、上传成功后把 name、original_name、url、file_size、mime_type、page_count 回传给后端
    7、后端校验 kb 权限，做文件版本号递增逻辑，写入documents主表 + document_versions版本记录表
    8、列表 / 预览时后端生成 MinIO 临时签名 URL 返回前端，禁止公开桶直链访问
    9、前端删除文件，后端修改documents主表status状态，做文件软删除（为后期文件追踪保留）


# 前端
    大文件分片上传：文件 > 20MB 切 5MB 分片，用minioClient.createMultipartUpload断点续传
    STS 凭证过期自动续期：上传中途 token 过期重新调用接口拿新凭证继续上传
    上传进度监听：putObject传入 progress 回调做进度条
    上传前后缀白名单校验：和后端白名单保持一致
    版本回滚弹窗：调用后端回滚接口切换历史版本

# 后端
## MinIO 侧配置
    1、创建存储桶：knowledge-base-files，桶策略设为私有（private）
    2、创建一个服务账号（系统固定 AK/SK），拥有该桶 s3:PutObject、s3:ListBucket、s3:GetObject、s3:DeleteObject 权限
    3、开启 MinIO STS AssumeRole 功能，允许基于固定账号签发临时角色凭证
    4、配置临时凭证最大有效期（建议最长 1h，前端可续期）

# 全链路关键注意点 & 踩坑规避（重中之重）

## （一）后端侧注意事项
### 1. STS 权限安全限制（最核心）
      Policy 强制限定只能上传到 kb/{kbId}/ 前缀，防止用户拿到 STS 随意上传到其他知识库目录；
      临时凭证有效期不要过长，建议 1 小时内，减少泄露风险；
      STS 只开放PutObject写入权限，不开放删除、覆盖其他文件权限。
### 2. 权限校验绝对不能漏
      两个接口必须都过权限守卫：
      /get-minio-sts 拿凭证前校验上传权限
      /save-meta 回写元数据二次校验（防止前端伪造 kbId 提交）
### 3. 文件版本机制规则约束
      用 kb_id + file_md5 唯一索引保证同一个知识库相同文件只一条主记录；
      版本历史表只存旧路径，不删除 MinIO 旧文件；彻底删除文档时遍历所有版本 object 全部调用 MinIO 删除；
      版本回滚只替换主表storage_object指向历史版本，不重新上传文件。
### 4. MinIO 文件访问安全
      桶必须私有，所有预览 / 下载都由后端生成带过期时间的签名 URL；
      禁止直接返回 MinIO 原始内网地址给前端；
      文件名特殊字符、中文后端入库统一转义，避免 MinIO 路径报错。
### 5. 事务与幂等
      保存元数据必须包裹数据库事务，防止：文件上传成功、数据库写入失败导致数据不一致；
      前端重复提交加幂等 key 防重复创建版本。

## （二）前端侧注意事项
    STS 临时密钥仅内存使用，绝不存储 localStorage/cookie，页面刷新直接销毁；
    文件 MD5 前端计算仅用于版本判断，后端可按需二次校验文件完整性；
    上传失败捕获异常，清除无效 MinIO 垃圾文件（可加后端清理接口）；
    分片上传做好中断、暂停、重试逻辑，超大文件必上分片。

## （三）MinIO 运维注意事项
    开启桶生命周期规则：回收站标记的文档对应文件 N 天后自动清理；
    定期巡检孤立垃圾文件（MinIO 存在但数据库无记录），做定时清理脚本；
    内网 MinIO 加 Nginx 反向代理，对外只暴露域名 + 443 HTTPS。

## （四）版本业务规则补充说明
    同一知识库、同一个 MD5 文件多次上传 → 版本号递增，旧版本归档历史表；
    不同知识库、相同 MD5 文件 → 相互独立，各自版本号从 1 开始；
    版本回滚后，再次上传同文件继续在回滚后的版本号往上累加。
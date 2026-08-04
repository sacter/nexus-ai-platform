# 文件上传
目前支持pdf,doc,docx,xls,xlsx,ppt,pptx,md,txt上传，上传到MinIO

# 上传流程
    1、前端拖动或选择上传文件到本地列表，点击上传按钮；一次性选多个文件，循环串行 / 并行上传，批量入库
    2、前端携带知识库ID(kbId)请求后端GET /upload/get-minio-sts 获取临时 STS 凭证
    3、后端收到 /upload/get-minio-sts 请求，做两件事：JWT 登录鉴权、校验当前用户对该 kbId 是否拥有admin/editor上传权限（viewer 直接拒绝）
    4、权限通过，后端调用 MinIO AssumeRole 接口生成临时 STS AccessKey/SecretKey/SessionToken + 过期时间 + 上传 Policy返回前端
    5、前端用 minio-js + STS 临时凭证直传文件到 MinIO 指定桶 + 指定前缀路径；
      Axios 封装切片上传 / 普通上传，分片上传：超过 20MB 自动切分 5MB 一片，OSS 分片上传，支持断点续传、暂停、重试；
      文件类型白名单校验、大小校验、进度条、文件头魔术校验；
    6、上传成功后把 name、original_name、url、file_size、mime_type、page_count 回传给后端
    7、后端校验 kb 权限，做文件版本号新写、递增逻辑，写入documents主表 + document_versions版本记录表
    8、列表 / 预览时后端生成 MinIO 临时签名 URL 返回前端，禁止公开桶直链访问
    9、前端删除文件，后端修改documents主表status状态，做文件软删除（为后期文件追踪保留）


# 前端
    文件的 name 用来判断文件是否是同组不同版本，比如：《系统需求说明书》《知识库使用规范》，用来分组版本；字段是选择+填写，做文字解释；
    大文件分片上传：文件 > 20MB 切 5MB 分片，用minioClient.createMultipartUpload断点续传
    STS 凭证过期自动续期：上传中途 token 过期重新调用接口拿新凭证继续上传
    上传进度监听：putObject传入 progress 回调做进度条
    上传前后缀白名单校验：和后端白名单保持一致
    当前活跃版本弹窗：调用后端接口切换当前活跃版本
    文件列表支持：查看文件、文件历史版本、切换当前活跃版本、重新embdding等操作


# 后端
## MinIO 侧配置
    1、创建存储桶：knowledge-base-files，桶策略设为私有（private）
    2、创建一个服务账号（系统固定 AK/SK），拥有该桶 s3:PutObject、s3:ListBucket、s3:GetObject、s3:DeleteObject 权限
    3、开启 MinIO STS AssumeRole 功能，允许基于固定账号签发临时角色凭证
    4、配置临时凭证最大有效期（1h，前端可续期）


# 全链路关键注意点 & 踩坑规避（重中之重）

## （一）后端侧注意事项
### 1. STS 权限安全限制（最核心）
      Policy 强制限定只能上传到 kb/{kbId}/ 前缀，防止用户拿到 STS 随意上传到其他知识库目录；
      临时凭证有效期不要过长，1 小时内，减少泄露风险；
      STS 只开放PutObject写入权限，不开放删除、覆盖其他文件权限；
### 2. 权限校验绝对不能漏
      两个接口必须都过权限守卫：
        /get-minio-sts 拿凭证前校验上传权限
        /save-meta 回写元数据二次校验（防止前端伪造 kbId 提交）
### 3. 文件版本机制规则约束
      用 kb_id + name 唯一索引递增document_versions版本记录；同一文档 v1/v2/v3, 不覆盖；
      版本历史表只存旧路径，不删除 MinIO 旧文件；彻底删除文档时遍历所有版本 object 全部调用 MinIO 删除；
      版本使用只替换document表current_version_id指向历史版本，不重新上传文件；
### 4. MinIO 文件访问安全
      桶必须私有，所有预览 / 下载都由后端生成带过期时间的签名 URL；
      禁止直接返回 MinIO 原始内网地址给前端；
      文件名特殊字符、中文后端入库统一转义，避免 MinIO 路径报错；
### 5. 事务与幂等
      保存元数据必须包裹数据库事务，防止：文件上传成功、数据库写入失败导致数据不一致；
      前端重复提交加幂等 key 防重复创建版本；

## （二）前端侧注意事项
    STS 临时密钥仅内存使用，绝不存储 localStorage/cookie，页面刷新直接销毁；
    上传失败捕获异常，清除无效 MinIO 垃圾文件（可加后端清理接口）；
    分片上传做好中断、暂停、重试逻辑，超大文件必上分片；

## （三）MinIO 运维注意事项
    关闭桶生命周期规则，禁止任何自动清理逻辑；删除动作完全由用户手动操作触发；
    内网 MinIO 加 Nginx 反向代理，对外只暴露域名 + 443 HTTPS；

## （四）版本业务规则补充说明
    同一知识库、同一个 name 文件多次上传 → 版本号递增；
    不同知识库、相同 name 文件 → 相互独立，各自版本号从 1 开始；

# 数据库
## 4.4 documents — 文档表

```sql
CREATE TYPE document_status AS ENUM (
    'UPLOADING',
    'PROCESSING',
    'READY',
    'FAILED',
    'DELETED'
);

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 知识库关联 ★
    kb_id               UUID          NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    -- 上传者
    user_id             UUID          REFERENCES users(id) ON DELETE SET NULL,
    -- 当前活跃版本 ★
    current_version_id  UUID                   DEFAULT NULL,

    -- 文件信息
    name                VARCHAR(512)  NOT NULL,
    original_name       VARCHAR(512)  NOT NULL,
    url                 VARCHAR(1024) NOT NULL,               -- MinIO object key
    file_size           BIGINT        NOT NULL DEFAULT 0,
    mime_type           VARCHAR(128)  NOT NULL DEFAULT 'application/pdf',
    page_count          INTEGER                DEFAULT 0,

    -- 状态
    status              document_status NOT NULL DEFAULT 'UPLOADING',

    -- 索引统计 (聚合当前版本)
    chunk_count         INTEGER        NOT NULL DEFAULT 0,
    embedding_model     VARCHAR(64)             DEFAULT NULL,
    embedding_dim       INTEGER                 DEFAULT NULL,

    -- 错误
    error_message       TEXT                    DEFAULT NULL,

    -- 时间戳
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_documents_kb_id       ON documents(kb_id);
CREATE INDEX idx_documents_user_id     ON documents(user_id);
CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_created_at  ON documents(created_at DESC);

COMMENT ON TABLE documents IS '文档表 — 关联知识库, 通过 current_version_id 指向当前活跃版本';
```

## 4.5 document_versions — 文档版本表

```sql
CREATE TYPE version_status AS ENUM ('PROCESSING', 'READY', 'FAILED');

CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID           NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    version_number  INTEGER        NOT NULL DEFAULT 1,         -- v1, v2, v3...
    file_url        VARCHAR(1024)  NOT NULL,                   -- 该版本的 MinIO key
    page_count      INTEGER        NOT NULL DEFAULT 0,
    chunk_count     INTEGER        NOT NULL DEFAULT 0,
    status          version_status NOT NULL DEFAULT 'PROCESSING',
    change_summary  TEXT                    DEFAULT NULL,       -- 变更说明

    created_by      UUID           REFERENCES users(id),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    UNIQUE (document_id, version_number)
);

CREATE INDEX idx_versions_document_id ON document_versions(document_id);

COMMENT ON TABLE document_versions IS '文档版本表 — 同一文档 v1/v2/v3, 不覆盖';
COMMENT ON COLUMN document_versions.change_summary IS '版本变更说明, 如 "更新了考勤规则章节"';
```
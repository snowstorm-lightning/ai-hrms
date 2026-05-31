import {
  AuditOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  EyeOutlined,
  LockOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Row, Space, Steps, Tag, Timeline, Typography } from "antd";
import { useAuth } from "../../app/AuthContext";
import { PageTitle } from "../../components/PageTitle";

const dailyPath = [
  { title: "看 Dashboard", content: "先确认组织、知识、Agent、审计和高风险待确认状态。" },
  { title: "问 AI Command", content: "让系统生成解释、计划或工具预览；高风险只进入人工确认。" },
  { title: "查 Knowledge", content: "打开引用来源、trustLevel、sensitivity 和 scope。" },
  { title: "跑 Agent", content: "查看 runType、toolPreview、humanReviewRequired 与 auditStatus。" },
  { title: "留 Evidence", content: "在 Audit & Evidence 复盘建议、人工确认和证据链。" },
];

const roleGuides = [
  { icon: <TeamOutlined />, role: "HR", copy: "用组织数据、知识引用和审计事件生成可复核的人力资源建议。" },
  { icon: <BookOutlined />, role: "员工", copy: "在 Co-Growth Engine 中完成 AI literacy、mission、work journal 和成长证据。" },
  { icon: <CheckCircleOutlined />, role: "导师", copy: "处理复盘反馈、学习建议确认和高风险人工复核。" },
  { icon: <SafetyCertificateOutlined />, role: "管理者", copy: "看组织能力、Agent 运行、风险模式和治理状态。" },
];

export function HelpPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes("group_admin"));

  return (
    <div className="help-page" data-vc-page="help">
      <PageTitle
        title="新手使用指南"
        description="用 5 分钟理解 AI-HRMS：什么交给程序，什么交给模型，什么必须由人确认。"
      />

      <Alert
        type="info"
        showIcon
        icon={<EyeOutlined />}
        title="当前页面是登录后可见的产品内教学文档"
        description="普通用户只能看到通用工作流和个人/协作场景。管理员操作指南只对 group_admin 显示，避免把账号、scope、RAG 发布和治理配置暴露给不相关角色。"
      />

      <section className="guide-hero">
        <div>
          <Typography.Title level={2}>AI-HRMS 不是聊天框，而是人和 Agent 协作的操作系统</Typography.Title>
          <Typography.Paragraph>
            程序负责稳定流程、权限、scope、审计和可重复计算；LLM 负责解释、总结、计划生成和跨上下文表达；人负责判断、确认、复盘和纠偏。
          </Typography.Paragraph>
          <Space wrap>
            <Tag color="blue">program-first</Tag>
            <Tag color="purple">LLM when flexible</Tag>
            <Tag color="red">human-in-the-loop</Tag>
            <Tag color="green">audit evidence</Tag>
          </Space>
        </div>
        <div className="guide-flow" aria-label="AI-HRMS 工作流示意图">
          {["Goal", "Context", "Agent Plan", "Tool Preview", "Human Review", "Audit"].map((item, index) => (
            <div key={item} className="guide-flow-node">
              <span>{index + 1}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <Card title="3 分钟推荐路径" className="guide-card">
        <Steps current={0} items={dailyPath} />
      </Card>

      <Row gutter={[16, 16]}>
        {roleGuides.map((item) => (
          <Col xs={24} md={12} xl={6} key={item.role}>
            <Card className="role-guide-card">
              <div className="role-guide-icon">{item.icon}</div>
              <Typography.Text strong>{item.role}</Typography.Text>
              <Typography.Paragraph type="secondary">{item.copy}</Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Visual Copilot 怎么用" className="guide-card">
            <Timeline
              items={[
                { icon: <EyeOutlined />, content: "不用圈选也能直接问当前页面，系统会读取页面路由和可见业务对象摘要。" },
                { icon: <RobotOutlined />, content: "需要解释某个表格行、卡片、按钮或字段时，点击“开始圈选”，面板会收起成窄侧栏。" },
                { icon: <DatabaseOutlined />, content: "圈选命中业务对象后，后端按当前 scope 从 Postgres 取上下文；DeepSeek 不直接访问数据库。" },
                { icon: <AuditOutlined />, content: "执行路径、Context Resolver 和证据默认折叠，需要排查时再展开。" },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="什么时候不该调用大模型" className="guide-card">
            <Timeline
              items={[
                { color: "green", content: "数量、状态、列表、scope 可见性：优先用 SQL 和程序规则。" },
                { color: "green", content: "删除、保存、权限判断、审计写入：只走确定性业务流程。" },
                { color: "blue", content: "制度解释、计划生成、多来源摘要：可调用 LLM，但必须带引用和边界。" },
                { color: "red", content: "录用、淘汰、降薪、晋升等高风险裁决：AI 只允许生成预览和检查清单。" },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {isAdmin ? (
        <Card title="管理员指南" className="guide-card admin-guide" data-vc-kind="admin-guide">
          <Alert
            type="warning"
            showIcon
            icon={<LockOutlined />}
            title="仅 group_admin 可见"
            description="管理员可以维护账号、角色、法人 scope、组织 scope 和 RAG 资料发布。删除组织单元前，系统会检查子组织、员工任职、消息、角色 scope 与 RAG scope 引用。"
          />
          <Row gutter={[12, 12]}>
            {["先建法人 scope", "再建组织 scope", "绑定角色与可见范围", "发布 RAG 资料并设置 sensitivity", "用 Audit 检查高风险操作"].map((item) => (
              <Col xs={24} md={12} xl={8} key={item}>
                <div className="admin-guide-step">
                  <SafetyCertificateOutlined />
                  <span>{item}</span>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      ) : null}
    </div>
  );
}

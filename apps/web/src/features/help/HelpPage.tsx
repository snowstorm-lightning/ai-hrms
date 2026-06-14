import {
  ArrowRightOutlined,
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
import { Alert, Button, Card, Col, Row, Space, Steps, Tag, Timeline, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthContext";
import { PageTitle } from "../../components/PageTitle";

const dailyPath = [
  { title: "看指挥看板", content: "先确认组织、知识库、智能任务、审计和高风险待确认状态。", path: "/app/dashboard", cta: "打开指挥看板" },
  { title: "问指挥中心", content: "让系统生成解释、计划或动作草稿；高风险只进入人工确认。", path: "/app/ai-command", cta: "去指挥中心提问" },
  { title: "查知识库", content: "打开引用来源、可信等级、敏感级别和可见范围。", path: "/app/docs", cta: "去文档库核验" },
  { title: "看智能任务", content: "查看任务类型、动作草稿、人工复核状态与审计状态。", path: "/app/agents", cta: "看运行中心" },
  { title: "留复盘证据", content: "在审计页回看建议、人工确认和证据链。", path: "/app/audit", cta: "查看审计证据" },
];

const roleGuides = [
  { icon: <TeamOutlined />, role: "HR", copy: "用组织数据、知识引用和审计事件生成可复核的人力资源建议。" },
  { icon: <BookOutlined />, role: "员工", copy: "在共生成长页完成 AI 素养任务、工作复盘和成长证据沉淀。" },
  { icon: <CheckCircleOutlined />, role: "导师", copy: "处理复盘反馈、学习建议确认和高风险人工复核。" },
  { icon: <SafetyCertificateOutlined />, role: "管理者", copy: "看组织能力、智能任务运行、风险模式和治理状态。" },
];

export function HelpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
        description="普通用户只能看到通用工作流和个人/协作场景。管理员操作指南只对管理员显示，避免把账号、可见范围、知识库发布和治理配置暴露给不相关角色。"
      />

      <section className="guide-hero">
        <div>
          <Typography.Title level={2}>AI-HRMS 人机协作操作系统</Typography.Title>
          <Typography.Paragraph>
            系统负责稳定流程、权限、可见范围、审计和可重复计算；模型负责解释、总结、计划生成和跨上下文表达；人负责判断、确认、复盘和纠偏。
          </Typography.Paragraph>
          <Space wrap>
            <Tag color="blue">确定流程优先</Tag>
            <Tag color="purple">复杂表达用模型辅助</Tag>
            <Tag color="red">人工确认</Tag>
            <Tag color="green">审计证据</Tag>
          </Space>
        </div>
        <div className="guide-flow" aria-label="AI-HRMS 工作流示意图">
          {["提出目标", "补充上下文", "形成方案", "生成动作草稿", "人工确认", "进入审计"].map((item, index) => (
            <div key={item} className="guide-flow-node">
              <span>{index + 1}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <Card title="推荐体验路径" className="guide-card">
        <Steps current={0} items={dailyPath.map((item) => ({ title: item.title, content: item.content }))} />
        <div className="guide-path-actions">
          {dailyPath.map((item) => (
            <Button key={item.path} icon={<ArrowRightOutlined />} onClick={() => navigate(item.path)}>
              {item.cta}
            </Button>
          ))}
        </div>
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
                { icon: <DatabaseOutlined />, content: "圈选命中业务对象后，系统按当前可见范围整理上下文；模型只看到必要摘要。" },
                { icon: <AuditOutlined />, content: "执行路径、上下文匹配明细和证据默认折叠，需要排查时再展开。" },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="什么时候不该调用大模型" className="guide-card">
            <Timeline
              items={[
                { color: "green", content: "数量、状态、列表、可见范围：优先用系统查询和程序规则。" },
                { color: "green", content: "删除、保存、权限判断、审计写入：只走确定性业务流程。" },
                { color: "blue", content: "制度解释、计划生成、多来源摘要：可调用模型，但必须带引用和边界。" },
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
            title="仅管理员可见"
            description="管理员可以维护账号、角色、法人可见范围、组织可见范围和知识库资料发布。删除组织单元前，系统会检查子组织、员工任职、消息、角色可见范围与知识库引用。"
          />
          <Row gutter={[12, 12]}>
            {["先建法人可见范围", "再建组织可见范围", "绑定角色与可见范围", "发布知识库资料并设置敏感级别", "用审计页检查高风险操作"].map((item) => (
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

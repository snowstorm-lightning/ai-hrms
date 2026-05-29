import { Button, Card, Col, Progress, Row, Space, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useState, type HTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { LearningCourse, LearningEnrollment, LearningRecommendation } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function LearningPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [enrollments, setEnrollments] = useState<LearningEnrollment[]>([]);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [coursePage, enrollmentPage, recommendationPage] = await Promise.all([
        api.learningCourses(1, 20),
        api.learningEnrollments(1, 20),
        api.learningRecommendations(1, 20),
      ]);
      setCourses(coursePage.rows ?? []);
      setEnrollments(enrollmentPage.rows ?? []);
      setRecommendations(recommendationPage.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "学习中心加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div data-vc-page="learning">
      <PageTitle title="Learning Layer" description="AI-HRMS 的学习层：入职计划、课程进度、AI 建议和 Co-Growth 成长证据共同服务于人机共生成长。" />
      <InlineError message={error} onRetry={reload} />
      <Card className="section-card learning-cogrowth-entry" data-vc-kind="co-growth-entry-card">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={16}>
            <Typography.Title level={4}>进入 Co-Growth OS｜AI-HRMS 成长引擎</Typography.Title>
            <Typography.Paragraph type="secondary">
              学习不只是课程，而是“AI 原理 + 工作 mission + 复盘 + 证据 + 审计”。在不牺牲交付的前提下，把本周真实任务转化成可验证的 AI 实战成长路径。
            </Typography.Paragraph>
          </Col>
          <Col xs={24} md={8}>
            <Space wrap>
              <Button type="primary" onClick={() => navigate("/co-growth")} data-vc-action="learning.open_co_growth">
                进入共进学习舱
              </Button>
              <Button onClick={() => navigate("/co-growth")} data-vc-action="learning.generate_ai_path">
                AI 生成学习路径
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="课程" value={courses.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="分配" value={enrollments.length} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="AI 建议" value={recommendations.length} /></Card></Col>
      </Row>
      <Table
        className="section-card"
        rowKey="id"
        loading={loading}
        dataSource={courses}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: <EmptyBlock description="暂无课程" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "learning",
          "data-vc-object-id": row.id,
          "data-vc-label": row.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "课程", dataIndex: "title", width: 220 },
          { title: "说明", dataIndex: "description", width: 420, ellipsis: true },
          { title: "课时", dataIndex: "lessonCount", width: 100 },
          { title: "状态", dataIndex: "status", width: 120, render: (status) => <Tag color="green">{status}</Tag> },
        ]}
      />
      <Card className="section-card" title="学习进度">
        <div className="progress-list">
          {enrollments.length ? enrollments.map((item) => (
            <div className="progress-row" key={item.id} data-vc-kind="learning-enrollment" data-vc-object-type="employee" data-vc-object-id={item.employeeId}>
              <div>
                <Typography.Text strong>{item.employeeName} · {item.courseTitle}</Typography.Text>
                <Typography.Text type="secondary">状态：{item.status}</Typography.Text>
              </div>
              <Progress percent={item.status === "completed" ? 100 : 35} style={{ width: 180 }} />
            </div>
          )) : <Typography.Text type="secondary">暂无学习分配</Typography.Text>}
        </div>
      </Card>
      <Card className="section-card" title="AI 学习建议">
        <div className="reference-list">
          {recommendations.length ? recommendations.map((item) => (
            <div className="reference-row" key={item.id} data-vc-kind="learning-recommendation" data-vc-object-id={item.id}>
              <Typography.Text strong>{item.title}</Typography.Text>
              <Typography.Text type="secondary">{item.reason}</Typography.Text>
              <Space wrap>
                <Tag color="blue">{item.recommendationType}</Tag>
                <Tag>{item.status}</Tag>
              </Space>
            </div>
          )) : (
            <div className="reference-row">
              <Typography.Text strong>示例：把本周工作任务转化为 AI 实战 mission</Typography.Text>
              <Typography.Text type="secondary">进入共进学习舱后可看到包含风险等级、证据来源、置信度和人工确认点的建议。</Typography.Text>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

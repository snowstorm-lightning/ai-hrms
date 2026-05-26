import { Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useState, type HTMLAttributes } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { LearningCourse, LearningEnrollment, LearningRecommendation } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

export function LearningPage() {
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
      <PageTitle title="学习中心" description="入职计划、课程进度、测验和成长建议。" />
      <InlineError message={error} onRetry={reload} />
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
        locale={{ emptyText: <EmptyBlock description="暂无课程" /> }}
        onRow={(row) => ({
          "data-vc-kind": "table-row",
          "data-vc-object-type": "learning",
          "data-vc-object-id": row.id,
          "data-vc-label": row.title,
        } as HTMLAttributes<HTMLElement>)}
        columns={[
          { title: "课程", dataIndex: "title" },
          { title: "说明", dataIndex: "description" },
          { title: "课时", dataIndex: "lessonCount" },
          { title: "状态", dataIndex: "status", render: (status) => <Tag color="green">{status}</Tag> },
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
    </div>
  );
}

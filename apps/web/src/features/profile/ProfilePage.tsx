import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  BookOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import type { Assignment, Employee, User } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageTitle } from "../../components/PageTitle";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

function clean(value?: string | null) {
  return value?.trim() || "-";
}

function compactPhone(value?: string) {
  return (value ?? "").replace(/\D/g, "");
}

function findCurrentEmployee(user: User, employees: Employee[]) {
  return employees.find((employee) => employee.userId === user.id)
    ?? employees.find((employee) => compactPhone(employee.mobile) === compactPhone(user.mobile))
    ?? employees.find((employee) => user.username.includes(employee.name) || employee.name.includes(user.username))
    ?? (demoMode ? employees[0] : null);
}

function buildResume(employee: Employee) {
  const stored = employee.resume?.trim();
  if (stored) return stored;
  return [
    `${employee.name} 当前岗位为 ${employee.title || employee.primaryAssignment?.positionTitle || "未设置岗位"}。`,
    `主任职范围：${employee.primaryAssignment?.legalEntityName ?? (employee.homeCompany || "未分配法人")} / ${employee.primaryAssignment?.orgUnitName ?? "未分配组织"}。`,
    `教育背景：${employee.highestDegreeOfEducation || "未维护学历"}，${employee.graduateSchool || "未维护毕业学校"}，${employee.major || "未维护专业"}。`,
    employee.remarks ? `备注：${employee.remarks}` : "暂无额外履历正文，可在员工数据层维护 resume 字段。",
  ].join("\n");
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, employeePage] = await Promise.all([api.profile(), api.employees(1, 100)]);
      const matchedEmployee = findCurrentEmployee(profile, employeePage.rows ?? []);
      const matchedAssignments = matchedEmployee
        ? await api.employeeAssignments(matchedEmployee.id).catch(() => matchedEmployee.assignments ?? [])
        : [];
      setUser(profile);
      setEmployee(matchedEmployee);
      setAssignments(matchedAssignments ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "个人简历加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const resume = useMemo(() => employee ? buildResume(employee) : "", [employee]);
  const currentAssignment = employee?.primaryAssignment ?? assignments.find((item) => item.isPrimary) ?? assignments[0];

  if (loading) {
    return (
      <main data-vc-page="profile-resume">
        <PageTitle title="个人简历" description="当前用户绑定的员工档案、任职轨迹和履历摘要。" />
        <Skeleton active paragraph={{ rows: 8 }} />
      </main>
    );
  }

  return (
    <main data-vc-page="profile-resume" data-vc-kind="profile-page">
      <PageTitle
        title="个人简历"
        description="当前用户绑定的员工档案、任职轨迹和履历摘要。"
        meta={(
          <Space size={8} wrap>
            {demoMode ? <Tag color="blue">演示环境</Tag> : null}
            <Tag color="red">个人敏感数据</Tag>
          </Space>
        )}
      />
      <InlineError message={error} onRetry={reload} />
      <Alert
        className="section-card"
        type="info"
        showIcon
        title="个人履历只用于本人查看、HR 维护和授权流程"
        description="AI 可以辅助整理摘要和证据，不会自动生成任用、薪资、绩效或纪律处分结论；涉及人事影响动作必须人工确认并留痕。"
      />

      {!employee ? (
        <Card>
          <EmptyBlock description="当前账号尚未绑定员工档案，无法生成个人简历。" />
          <Button type="primary" onClick={() => navigate("/app/employees")}>前往员工数据层</Button>
        </Card>
      ) : (
        <>
          <section className="profile-hero" data-vc-kind="profile-summary" data-vc-object-type="employee" data-vc-object-id={employee.id} data-vc-label={employee.name}>
            <Avatar size={72} icon={<UserOutlined />} />
            <div className="profile-identity">
              <Typography.Title level={3}>{employee.name}</Typography.Title>
              <Typography.Text type="secondary">{employee.title || currentAssignment?.positionTitle || "未设置岗位"}</Typography.Text>
              <Space size={8} wrap>
                <Tag color="blue">{employee.employeeNo}</Tag>
                <Tag>{employee.status}</Tag>
                <Tag>{clean(currentAssignment?.orgUnitName)}</Tag>
              </Space>
            </div>
            <Space wrap className="profile-actions">
              <Button icon={<IdcardOutlined />} onClick={() => navigate("/app/employees")}>员工数据层</Button>
              <Button icon={<BookOutlined />} onClick={() => navigate("/co-growth")}>成长档案</Button>
            </Space>
          </section>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card title="履历摘要" className="profile-card" data-vc-kind="resume-summary">
                <Typography.Paragraph className="profile-resume-text">
                  {resume}
                </Typography.Paragraph>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="AI 与人审边界" className="profile-card" data-vc-kind="profile-ai-boundary">
                <Space orientation="vertical" size="middle">
                  <Alert showIcon type="warning" title="高影响 HR 决策必须人工确认" />
                  <div className="profile-boundary-list">
                    <span><SafetyCertificateOutlined /> 可用于履历摘要、证据整理和本人自助查看。</span>
                    <span><SafetyCertificateOutlined /> 不自动裁决绩效、薪资、录用、淘汰或纪律处分。</span>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="工作身份" className="profile-card" data-vc-kind="work-identity">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="账号">{user?.username ?? "-"}</Descriptions.Item>
                  <Descriptions.Item label="角色">{user?.roles?.join(", ") || "-"}</Descriptions.Item>
                  <Descriptions.Item label="主任职法人">{clean(currentAssignment?.legalEntityName ?? employee.homeCompany)}</Descriptions.Item>
                  <Descriptions.Item label="主任职组织">{clean(currentAssignment?.orgUnitName)}</Descriptions.Item>
                  <Descriptions.Item label="岗位">{clean(currentAssignment?.positionTitle ?? employee.title)}</Descriptions.Item>
                  <Descriptions.Item label="用工类型">{clean(currentAssignment?.employmentType)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="教育与联系" className="profile-card" data-vc-kind="education-contact">
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="最高学历">{clean(employee.highestDegreeOfEducation)}</Descriptions.Item>
                  <Descriptions.Item label="毕业学校">{clean(employee.graduateSchool)}</Descriptions.Item>
                  <Descriptions.Item label="专业">{clean(employee.major)}</Descriptions.Item>
                  <Descriptions.Item label="所在地">{clean(employee.placeOfResidence)}</Descriptions.Item>
                  <Descriptions.Item label="手机号">{clean(employee.mobile)}</Descriptions.Item>
                  <Descriptions.Item label="个人邮箱">{clean(employee.personalMailbox)}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24}>
              <Card title="任职轨迹" className="profile-card" data-vc-kind="assignment-timeline">
                {assignments.length ? (
                  <Timeline
                    items={assignments.map((item) => ({
                      color: item.isPrimary ? "blue" : "gray",
                      icon: item.isPrimary ? <TeamOutlined /> : undefined,
                      content: (
                        <Space orientation="vertical" size={2}>
                          <Typography.Text strong>{clean(item.positionTitle)}</Typography.Text>
                          <Typography.Text type="secondary">{clean(item.legalEntityName)} / {clean(item.orgUnitName)}</Typography.Text>
                          <Typography.Text type="secondary">{clean(item.startDate)} 至 {item.endDate ? clean(item.endDate) : "至今"}</Typography.Text>
                        </Space>
                      ),
                    }))}
                  />
                ) : (
                  <EmptyBlock description="暂无任职轨迹" />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </main>
  );
}

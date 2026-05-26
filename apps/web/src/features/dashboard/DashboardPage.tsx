import { Card, Col, Row, Statistic, Timeline, Typography } from "antd";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import type { Employee, LegalEntity, OrgUnit } from "../../api/types";
import { EmptyBlock, InlineError } from "../../components/AsyncState";
import { PageLoading } from "../../components/PageLoading";
import { PageTitle } from "../../components/PageTitle";

export function DashboardPage() {
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [entities, units, employeePage] = await Promise.all([api.legalEntities(), api.orgUnits(), api.employees(1, 5)]);
      setLegalEntities(entities);
      setOrgUnits(units);
      setEmployees(employeePage.rows ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "工作台数据加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <>
      <PageTitle title="工作台" description="查看组织、员工和近期人事动态。" />
      <InlineError message={error} onRetry={reload} />
      {loading ? <PageLoading /> : null}
      {!loading ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}><Card><Statistic title="法人实体" value={legalEntities.length} /></Card></Col>
            <Col xs={24} md={8}><Card><Statistic title="组织单元" value={orgUnits.length} /></Card></Col>
            <Col xs={24} md={8}><Card><Statistic title="员工样本" value={employees.length} suffix="人" /></Card></Col>
          </Row>
          <Card className="section-card" title="最近员工">
            {employees.length ? (
              <Timeline
                items={employees.map((employee) => ({
                  content: (
                    <Typography.Text>
                      {employee.name} · {employee.primaryAssignment?.orgUnitName ?? "未分配组织"}
                    </Typography.Text>
                  ),
                }))}
              />
            ) : <EmptyBlock description="暂无员工数据" />}
          </Card>
        </>
      ) : null}
    </>
  );
}

const { Types } = require('mongoose');
const { Task, Employee, Department, Project } = require('../models');
const AppError = require('../utils/AppError');

async function getWorkload(organizationId, filters = {}) {
  const { department, project, employee, status } = filters;
  const query = { organizationId: new Types.ObjectId(organizationId) };

  if (department) query.departmentId = new Types.ObjectId(department);
  if (employee) query._id = new Types.ObjectId(employee);
  if (status) query.status = status;

  const employees = await Employee.find(query)
    .populate('departmentId', 'name')
    .lean();

  const employeeIds = employees.map((e) => e._id);

  const taskQuery = {
    organizationId: new Types.ObjectId(organizationId),
    assigneeIds: { $in: employeeIds },
  };

  if (project) taskQuery.projectId = new Types.ObjectId(project);
  if (status) taskQuery.status = status;

  const tasks = await Task.find(taskQuery)
    .populate('projectId', 'name key')
    .lean();

  const workloadMap = {};

  employees.forEach((emp) => {
    workloadMap[emp._id.toString()] = {
      employee: {
        id: emp._id.toString(),
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        employeeId: emp.employeeId,
        department: emp.departmentId?.name || null,
      },
      activeTasks: 0,
      overdueTasks: 0,
      completedTasks: 0,
      estimatedHours: 0,
      tasks: [],
    };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tasks.forEach((task) => {
    task.assigneeIds.forEach((assigneeId) => {
      const empId = assigneeId.toString();
      if (workloadMap[empId]) {
        workloadMap[empId].tasks.push({
          id: task._id.toString(),
          taskKey: task.taskKey,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          project: task.projectId,
          estimatedHours: task.estimatedHours,
        });

        if (task.status === 'DONE') {
          workloadMap[empId].completedTasks++;
        } else {
          workloadMap[empId].activeTasks++;
          workloadMap[empId].estimatedHours += task.estimatedHours || 0;

          if (task.dueDate && new Date(task.dueDate) < today) {
            workloadMap[empId].overdueTasks++;
          }
        }
      }
    });
  });

  const result = Object.values(workloadMap);
  result.sort((a, b) => b.activeTasks - a.activeTasks);

  return result;
}

async function getMyWorkload(organizationId, employeeId) {
  const employee = await Employee.findOne({
    _id: new Types.ObjectId(employeeId),
    organizationId: new Types.ObjectId(organizationId),
  });
  if (!employee) throw new AppError('Employee not found', 404);

  const tasks = await Task.find({
    organizationId: new Types.ObjectId(organizationId),
    assigneeIds: new Types.ObjectId(employeeId),
  })
    .populate('projectId', 'name key')
    .sort({ dueDate: 1 })
    .lean();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeTasks = tasks.filter((t) => t.status !== 'DONE');
  const overdueTasks = activeTasks.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const completedTasks = tasks.filter((t) => t.status === 'DONE');

  return {
    employee: {
      id: employee._id.toString(),
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      employeeId: employee.employeeId,
    },
    activeTasks: activeTasks.length,
    overdueTasks: overdueTasks.length,
    completedTasks: completedTasks.length,
    estimatedHours: activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    tasks: tasks.map((t) => ({
      id: t._id.toString(),
      taskKey: t.taskKey,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      project: t.projectId,
      estimatedHours: t.estimatedHours,
    })),
  };
}

module.exports = {
  getWorkload,
  getMyWorkload,
};

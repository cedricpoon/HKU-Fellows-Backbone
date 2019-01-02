// -----------------------------------------------------
// | ALL routes located here are for internal use ONLY |
// -----------------------------------------------------

const express = require('express');

const db = require('../database/connect');

const router = express.Router();

router.route('/courses').get(async (req, res) => {
  try {
    const list = [];
    const facs = await db.query('select * from Faculty');

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const fac of facs) {
      const facObj = {
        id: fac.FacultyId,
        title: fac.Description,
        links: [], // Faculty courses
        children: [], // Department
      };
      list.push(facObj); // linking

      const depts = await db.query(`
        select * from Department
          where FacultyId = "${fac.FacultyId}"
      `);
      for (const dept of depts) {
        const deptObj = {
          id: dept.DepartmentId,
          title: dept.Description,
          links: [], // Department courses
        };
        facObj.children.push(deptObj); // linking

        const courses = await db.query(`
          select * from Course
            where DepartmentId = "${dept.DepartmentId}"
        `);

        for (const course of courses) {
          // linking
          deptObj.links.push({
            id: course.CourseId,
            title: course.CourseId.toUpperCase(),
            description: course.Description,
          });
        }
      }

      const courses = await db.query(`
        select * from Course
          where FacultyId = "${fac.FacultyId}"
      `);
      for (const course of courses) {
        // linking
        facObj.links.push({
          id: course.CourseId,
          title: course.CourseId.toUpperCase(),
          description: course.Description,
        });
      }
    }
    /* eslint-disable no-restricted-syntax, no-await-in-loop */

    res.json(list);
  } catch (err) {
    res.send(err);
  }
});

module.exports = router;

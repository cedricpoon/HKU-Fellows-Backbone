// -----------------------------------------------------
// | ALL routes located here are for internal use ONLY |
// -----------------------------------------------------
const express = require('express');

const { db } = require('../database/connect');

const router = express.Router();

/* eslint-disable no-restricted-syntax, no-await-in-loop */
const deepLinkToRight = async (left, rightObj, { idName, childrenQuery }) => {
  const leftObj = {
    id: left[idName],
    title: left.Description,
    links: [],
    children: [],
  };

  // linking all children
  const children = await db.query(childrenQuery);
  for (const child of children) {
    await deepLinkToRight(child, leftObj, {
      idName: 'DepartmentId',
      childrenQuery: `
        select * from Department
          where SchoolId = "${left.DepartmentId}"
      `,
    });
  }

  rightObj.children.push(leftObj); // linking

  const courses = await db.query(`
    select * from Course
      where ${idName} = "${left[idName]}"
  `);

  for (const course of courses) {
    // linking
    leftObj.links.push({
      id: course.CourseId,
      title: course.CourseId.toUpperCase(),
      description: course.Description,
    });
  }
  // unset empty links
  if (leftObj.links.length === 0) {
    delete leftObj.links;
  } else {
    // sort links
    leftObj.links.sort((a, b) => a.id - b.id);
  }
  // unset empty children
  if (leftObj.children.length === 0) {
    delete leftObj.children;
  } else {
    // sort links
    leftObj.children.sort((a, b) => a.id - b.id);
  }
};

router.route('/courses').get(async (req, res) => {
  try {
    const list = { children: [] };
    const facs = await db.query('select * from Faculty');

    for (const fac of facs) {
      await deepLinkToRight(fac, list, {
        idName: 'FacultyId',
        childrenQuery: `
          select * from Department
            where FacultyId = "${fac.FacultyId}"
            and SchoolId is null
        `,
      });
    }
    res.json(list.children);
  } catch (err) {
    console.log(err);
    res.send(err.message);
  }
});
/* eslint-disable no-restricted-syntax, no-await-in-loop */

module.exports = router;

class Student {
  constructor(name, age, course) {
    this.name = name;
    this.age = age;
    this.course = course;
  }
  greet() {
    return `Hello, my name is ${this.name} and I am learning ${this.course}`;
  }
  study() {
    return `${this.name} is studying ${this.course}`;
  }
  static welcomeMessage() {
    return 'Welcome to the Student Management System!';
  }
}

function line(label, value) {
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  p.append(strong, document.createTextNode(value)); // textContent: user ka likha hua HTML nahi banta
  return p;
}

// "Class & Object" lesson ka live demo (purani public/js/class.js)
export function attachClassDemo(root) {
  const form = root.querySelector('#studentForm');
  const result = root.querySelector('#result');
  const welcomeBtn = root.querySelector('#showWelcome');
  const disposers = [];

  if (welcomeBtn) {
    const onWelcome = () => alert(Student.welcomeMessage());
    welcomeBtn.addEventListener('click', onWelcome);
    disposers.push(() => welcomeBtn.removeEventListener('click', onWelcome));
  }

  if (form && result) {
    const onSubmit = (e) => {
      e.preventDefault();
      const name = root.querySelector('#studentName').value.trim();
      const age = parseInt(root.querySelector('#studentAge').value.trim(), 10);
      const course = root.querySelector('#studentCourse').value.trim();

      result.replaceChildren();
      if (!name || !age || !course) {
        const warn = document.createElement('p');
        warn.style.color = 'red';
        warn.textContent = 'Please fill out all fields.';
        result.append(warn);
        return;
      }

      const student = new Student(name, age, course);
      const box = document.createElement('div');
      box.className = 'example-box';
      const title = document.createElement('h3');
      title.textContent = 'Student Created:';
      box.append(
        title,
        line('Name', student.name),
        line('Age', String(student.age)),
        line('Course', student.course),
        line('Greeting', student.greet()),
        line('Study Status', student.study())
      );
      result.append(box);
      form.reset();
    };
    form.addEventListener('submit', onSubmit);
    disposers.push(() => form.removeEventListener('submit', onSubmit));
  }

  return () => disposers.forEach((fn) => fn());
}

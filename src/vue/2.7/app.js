// Full spec-compliant TodoMVC with localStorage persistence
// and hash-based routing in ~150 lines.

// localStorage persistence
var STORAGE_KEY = "todos-vuejs-2.0";
var todoStorage = {
  fetch: function () {
    var todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    todos.forEach(function (todo, index) {
      todo.id = index;
    });
    todoStorage.uid = todos.length;
    return todos;
  },
  save: function (todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  },
};

// visibility filters
var filters = {
  all: function (todos) {
    return todos;
  },
  active: function (todos) {
    return todos.filter(function (todo) {
      return !todo.completed;
    });
  },
  completed: function (todos) {
    return todos.filter(function (todo) {
      return todo.completed;
    });
  },
};

Vue.use(Vue2use.default);

const {
  ref,
  getCurrentInstance,
  watch,
  computed,
  toValue,
  defineComponent,
  h,
  getCurrentWatcher,
  onWatcherCleanup,
} = Vue2use;

var n = ref(1);

var s = watch(
  () => {
    console.log(getCurrentWatcher());
    onWatcherCleanup(() => {
      console.log("onWatcherCleanup");
    });
    return [toValue(n)];
  },
  (v, _, fn) => {
    console.log(v);
    fn(() => {
      console.log("cleaup");
    });
  }
);

const TodoLayoutFooter = {
  props: {
    todos: { require: true, type: Array },
    remaining: {},
    visibility: {},
  },
  // useNativeSetup: true,
  setup(props, { attrs, slots, expose }) {
    expose({
      a: "TodoLayoutFooter",
    });
    defineComponent2();
    const vm = getCurrentInstance().proxy;
    console.log(attrs, slots, props);
    return () => {
      return props.todos.length
        ? h(
            "footer",
            {
              staticClass: "footer",
            },
            [
              h(
                "span",
                {
                  staticClass: "todo-count",
                },
                [
                  h("strong", [props.remaining]),
                  vm._v(
                    " " + vm._s(vm._f("pluralize")(props.remaining)) + " left"
                  ),
                ]
              ),
              vm._v(" "),
              h(
                "ul",
                {
                  staticClass: "filters",
                },
                [
                  h("li", [
                    h(
                      "a",
                      {
                        class: {
                          selected: props.visibility == "all",
                        },
                        attrs: {
                          href: "#/all",
                        },
                      },
                      [vm._v("All")]
                    ),
                  ]),
                  vm._v(" "),
                  h("li", [
                    h(
                      "a",
                      {
                        class: {
                          selected: props.visibility == "active",
                        },
                        attrs: {
                          href: "#/active",
                        },
                      },
                      [vm._v("Active")]
                    ),
                  ]),
                  vm._v(" "),
                  h("li", [
                    h(
                      "a",
                      {
                        class: {
                          selected: props.visibility == "completed",
                        },
                        attrs: {
                          href: "#/completed",
                        },
                      },
                      [vm._v("Completed")]
                    ),
                  ]),
                ]
              ),
              slots.clear({}),
            ]
          )
        : null;
    };
  },
};

function defineComponent2(options = {}) {
  defineComponent({
    filters: {
      pluralize: function (n) {
        return n === 1 ? "item" : "items";
      },
    },
    directives: {
      "todo-focus": function (el, binding) {
        if (binding.value) {
          el.focus();
        }
      },
    },
    mixins: [options],
  });
}

// app Vue instance
var app = new Vue({
  setup() {
    defineComponent2({
      components: { "todo-layout-footer": TodoLayoutFooter },
    });
    console.log(getCurrentInstance().proxy);
    const todos = ref(todoStorage.fetch());
    const newTodo = ref("");
    const editedTodo = ref(null);
    const visibility = ref("all");
    let beforeEditCache = "";

    watch(
      todos,
      (v) => {
        todoStorage.save(v);
      },
      {
        deep: true,
      }
    );

    const filteredTodos = computed(() => {
      return filters[toValue(visibility)](toValue(todos));
    });

    const remaining = computed(() => {
      return filters.active(toValue(todos)).length;
    });

    const allDone = computed(
      () => {
        return toValue(remaining) === 0;
      },
      (value) => {
        toValue(todos).forEach(function (todo) {
          todo.completed = value;
        });
      }
    );

    const addTodo = function () {
      var value = newTodo.value && newTodo.value.trim();
      if (!value) {
        return;
      }
      todos.value.push({
        id: todoStorage.uid++,
        title: value,
        completed: false,
      });
      newTodo.value = "";
    };

    const removeTodo = function (todo) {
      todos.value.splice(todos.value.indexOf(todo), 1);
    };

    const editTodo = function (todo) {
      beforeEditCache = todo.title;
      editedTodo.value = todo;
    };

    const doneEdit = function (todo) {
      if (!editedTodo.value) {
        return;
      }
      editedTodo.value = null;
      todo.title = todo.title.trim();
      if (!todo.title) {
        removeTodo(todo);
      }
    };

    const cancelEdit = function (todo) {
      editedTodo.value = null;
      todo.title = beforeEditCache;
    };

    const removeCompleted = function () {
      todos.value = filters.active(todos.value);
    };

    return {
      addTodo,
      removeTodo,
      doneEdit,
      cancelEdit,
      removeCompleted,
      editTodo,
      todos,
      newTodo,
      editedTodo,
      visibility,
      filteredTodos,
      remaining,
      allDone,
    };
  },
  data: {},
  watch: {},
  computed: {},

  methods: {},
});

// handle routing
function onHashChange() {
  var visibility = window.location.hash.replace(/#\/?/, "");
  if (filters[visibility]) {
    app.visibility = visibility;
  } else {
    window.location.hash = "";
    app.visibility = "all";
  }
}

window.addEventListener("hashchange", onHashChange);
onHashChange();

// mount
app.$mount(".todoapp");

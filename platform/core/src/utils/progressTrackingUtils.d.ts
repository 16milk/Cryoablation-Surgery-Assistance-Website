export default progressTrackingUtils;
declare namespace progressTrackingUtils {
    export { createList };
    export { isList };
    export { createTask };
    export { isTask };
    export { increaseList };
    export { update };
    export { finish };
    export { getOverallProgress };
    export { waitOn };
    export { addDeferred };
    export { setTaskName };
    export { getTaskByName };
    export { addObserver };
    export { removeObserver };
}
/**
 * Public Methods
 */
/**
 * Creates an instance of a task list
 * @returns {Object} A task list object
 */
declare function createList(): any;
/**
 * Checks if the given argument is a List instance
 * @param {any} subject The value to be tested
 * @returns {boolean} true if a valid List instance is given, false otherwise
 */
declare function isList(subject: any): boolean;
/**
 * Creates an instance of a task
 * @param {Object} list The List instance related to this task
 * @param {Object} next The next Task instance to link to
 * @returns {Object} A task object
 */
declare function createTask(list: any, next: any): any;
/**
 * Checks if the given argument is a Task instance
 * @param {any} subject The value to be tested
 * @returns {boolean} true if a valid Task instance is given, false otherwise
 */
declare function isTask(subject: any): boolean;
/**
 * Appends a new Task to the given List instance and notifies the list observers
 * @param {Object} list A List instance
 * @returns {Object} The new Task instance appended to the List or null if the
 *  given List instanc is not valid
 */
declare function increaseList(list: any): any;
/**
 * Updates the internal progress value of the given Task instance and notifies
 * the observers of the associated list.
 * @param {Object} task The Task instance to be updated
 * @param {number} value A number between 0 (inclusive) and 1 (exclusive)
 *  indicating the progress of the task;
 * @returns {void} Nothing is returned
 */
declare function update(task: any, value: number): void;
/**
 * Sets a Task instance as finished (progress = 1.0), freezes it in order to
 * prevent further modifications and notifies the observers of the associated
 * list.
 * @param {Object} task The Task instance to be finalized
 * @returns {void} Nothing is returned
 */
declare function finish(task: any): void;
/**
 * Generate a summarized snapshot of the current status of the given task List
 * @param {Object} list The List instance to be scanned
 * @returns {Object} An object representing the summarized status of the list
 */
declare function getOverallProgress(list: any): any;
/**
 * Adds a Task instance to the given list that waits on a given "thenable". When
 * the thenable resolves the "finish" method is called on the newly created
 * instance thus notifying the observers of the list.
 * @param {Object} list The List instance to which the new task will be added
 * @param {Object|Promise} thenable The thenable to be waited on
 * @returns {Object} A reference to the newly created Task;
 */
declare function waitOn(list: any, thenable: any | Promise<any>): any;
/**
 * Adds a Task instance to the given list using a deferred (a Promise that can
 * be externally resolved) notifying the observers of the list.
 * @param {Object} list The List instance to which the new task will be added
 * @returns {Object} An object with references to the created deferred and task
 */
declare function addDeferred(list: any): any;
/**
 * Assigns a name to a specific task of the list
 * @param {Object} list The List instance whose task will be named
 * @param {Object} task The specified Task instance
 * @param {string} name The name of the task
 * @returns {boolean} Returns true on success, false otherwise
 */
declare function setTaskName(list: any, task: any, name: string): boolean;
/**
 * Retrieves a task by name
 * @param {Object} list The List instance whose task will be retrieved
 * @param {string} name The name of the task to be retrieved
 * @returns {Object} The Task instance or null if not found
 */
declare function getTaskByName(list: any, name: string): any;
/**
 * Adds an observer (callback function) to a given List instance
 * @param {Object} list The List instance to which the observer will be appended
 * @param {Function} observer The observer (function) that will be executed
 *  every time a change happens within the list
 * @returns {boolean} Returns true on success and false otherwise
 */
declare function addObserver(list: any, observer: Function): boolean;
/**
 * Removes an observer (callback function) from a given List instance
 * @param {Object} list The instance List from which the observer will removed
 * @param {Function} observer The observer function to be removed
 * @returns {boolean} Returns true on success and false otherwise
 */
declare function removeObserver(list: any, observer: Function): boolean;

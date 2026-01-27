/**
 * Department Selector Module
 * Handles cascading dropdown logic for department selection
 */

class DepartmentSelector {
    constructor() {
        this.mainDeptSelect = null;
        this.subDeptSelect = null;
        this.selectedDepartment = {
            category: '',
            mainDept: null,
            subDept: null
        };
    }

    /**
     * Initialize the department selector
     */
    init() {
        this.mainDeptSelect = document.getElementById('departmentSelect');
        this.subDeptSelect = document.getElementById('subDepartmentSelect');

        if (!this.mainDeptSelect || !this.subDeptSelect) {
            console.error('Department select elements not found');
            return;
        }

        // Add event listener for main department selection
        this.mainDeptSelect.addEventListener('change', (e) => {
            this.onMainDepartmentChange(e.target.value);
        });

        // Add event listener for sub-department selection
        this.subDeptSelect.addEventListener('change', (e) => {
            this.onSubDepartmentChange(e.target.value);
        });
    }

    /**
     * Handle main department selection change
     * @param {string} category - Selected category (研發組, 業務組, etc.)
     */
    onMainDepartmentChange(category) {
        this.selectedDepartment.category = category;
        this.selectedDepartment.mainDept = null;
        this.selectedDepartment.subDept = null;

        if (!category) {
            // Hide sub-department dropdown if no category selected
            this.subDeptSelect.style.display = 'none';
            this.subDeptSelect.innerHTML = '<option value="">請選擇細項部門</option>';
            return;
        }

        // Populate sub-department dropdown
        this.populateSubDepartments(category);
    }

    /**
     * Populate sub-department dropdown based on selected category
     * @param {string} category - Selected category
     */
    populateSubDepartments(category) {
        const departments = DEPARTMENTS[category];

        if (!departments || departments.length === 0) {
            this.subDeptSelect.style.display = 'none';
            return;
        }

        // Clear existing options
        this.subDeptSelect.innerHTML = '<option value="">請選擇細項部門</option>';

        // Add department options
        departments.forEach(dept => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = dept.fullName;

            // Add the main department as an option
            const mainOption = document.createElement('option');
            mainOption.value = JSON.stringify({ type: 'main', code: dept.code, name: dept.name, fullName: dept.fullName });
            mainOption.textContent = dept.fullName;
            this.subDeptSelect.appendChild(mainOption);

            // Add sub-departments if they exist
            if (dept.subDepts && dept.subDepts.length > 0) {
                dept.subDepts.forEach(subDept => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        type: 'sub',
                        parentCode: dept.code,
                        parentName: dept.name,
                        code: subDept.code,
                        name: subDept.name,
                        fullName: subDept.fullName
                    });
                    option.textContent = '　　' + subDept.fullName;
                    this.subDeptSelect.appendChild(option);
                });
            }
        });

        // Show the sub-department dropdown
        this.subDeptSelect.style.display = 'inline-block';
    }

    /**
     * Handle sub-department selection change
     * @param {string} value - JSON string of selected department
     */
    onSubDepartmentChange(value) {
        if (!value) {
            this.selectedDepartment.mainDept = null;
            this.selectedDepartment.subDept = null;
            return;
        }

        try {
            const deptData = JSON.parse(value);

            if (deptData.type === 'main') {
                this.selectedDepartment.mainDept = deptData;
                this.selectedDepartment.subDept = null;
            } else if (deptData.type === 'sub') {
                this.selectedDepartment.mainDept = {
                    code: deptData.parentCode,
                    name: deptData.parentName
                };
                this.selectedDepartment.subDept = deptData;
            }

            console.log('Selected Department:', this.getSelectedDepartmentInfo());
        } catch (error) {
            console.error('Error parsing department data:', error);
        }
    }

    /**
     * Get the currently selected department information
     * @returns {Object} Selected department info
     */
    getSelectedDepartmentInfo() {
        return {
            category: this.selectedDepartment.category,
            mainDepartment: this.selectedDepartment.mainDept,
            subDepartment: this.selectedDepartment.subDept,
            fullPath: this.getFullDepartmentPath()
        };
    }

    /**
     * Get the full department path as a string
     * @returns {string} Full department path
     */
    getFullDepartmentPath() {
        const parts = [this.selectedDepartment.category];

        if (this.selectedDepartment.mainDept) {
            parts.push(this.selectedDepartment.mainDept.fullName || this.selectedDepartment.mainDept.name);
        }

        if (this.selectedDepartment.subDept) {
            parts.push(this.selectedDepartment.subDept.fullName || this.selectedDepartment.subDept.name);
        }

        return parts.filter(p => p).join(' > ');
    }

    /**
     * Reset the department selection
     */
    reset() {
        this.mainDeptSelect.value = '';
        this.subDeptSelect.value = '';
        this.subDeptSelect.style.display = 'none';
        this.selectedDepartment = {
            category: '',
            mainDept: null,
            subDept: null
        };
    }
}

// Initialize when DOM is ready
let departmentSelector;
document.addEventListener('DOMContentLoaded', () => {
    departmentSelector = new DepartmentSelector();
    window.departmentSelector = departmentSelector; // Make it global for app.js
    departmentSelector.init();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DepartmentSelector };
}
